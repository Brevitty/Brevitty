// Client-side state + API call for the public /register flow. The visitor's answers live in
// sessionStorage only (cleared when the tab closes); nothing is stored until they pick an option.
import { VERIFIED_CAMPUSES, EMAIL_RE, PHONE_RE, normalisePhone } from '../data/registrationOptions.js'

const STORAGE_KEY = 'brevitty.registration.v1'
const DONE_KEY = 'brevitty.registration.done.v1'

const EMPTY = {
  name: '',
  collegeStudent: '', // 'Yes' | 'No'
  campus: '',
  email: '',
  phone: '',
  studentEmail: '',
  department: '',
  course: '',
  semester: '',
  campusOfficialEmail: '',
}

function read(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null')
  } catch {
    return null // private mode / blocked storage / corrupt value
  }
}
function write(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: the flow still works within the open page, a refresh restarts it */
  }
}

export const loadRegistration = () => ({ ...EMPTY, ...(read(STORAGE_KEY) || {}) })
export const saveRegistration = (patch) => write(STORAGE_KEY, { ...loadRegistration(), ...patch })
export const loadDone = () => read(DONE_KEY) || {}
export const markDone = (option) => write(DONE_KEY, { ...loadDone(), [option]: true })
export function clearRegistration() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(DONE_KEY)
  } catch {
    /* ignore */
  }
}

/* ---- path logic (single source for the pages' guards) ---- */

export const hasStep1 = (d) =>
  Boolean(d.name && d.email && d.phone && (d.collegeStudent === 'No' || (d.collegeStudent === 'Yes' && d.campus)))

// Campus student from one of the four campuses who gave a student email -> Step 2 + all four options.
export const isVerifiedPath = (d) =>
  d.collegeStudent === 'Yes' && VERIFIED_CAMPUSES.includes(d.campus) && Boolean(d.studentEmail)

export const hasStep2 = (d) =>
  Boolean(d.studentEmail && d.department && d.course && d.semester && d.campusOfficialEmail)

// Where this visitor belongs, given what they've entered so far.
export function nextRoute(d) {
  if (!hasStep1(d)) return '/register'
  if (isVerifiedPath(d)) return hasStep2(d) ? '/register/student' : '/register/details'
  return '/register/open'
}

/* ---- validation (mirrors api/register.js) ---- */

export const isEmail = (v) => EMAIL_RE.test(String(v).trim())
export const isPhone = (v) => PHONE_RE.test(normalisePhone(String(v).trim()))

/* ---- API ---- */

const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.'
const GENERIC_ERROR = 'Something went wrong. Please try again.'

// -> { status: 'ok' | 'already' | 'error', message, data }
async function post(body) {
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return { status: 'ok', data: json.data }
    if (res.status === 409) return { status: 'already', message: json.error }
    return { status: 'error', message: json.error || GENERIC_ERROR }
  } catch {
    return { status: 'error', message: NETWORK_ERROR }
  }
}

// One-click options (Startup Arena, Mentorship, Grants).
export const submitRegistration = (option, data, honeypot = '') => post({ ...data, option, website: honeypot })

// Straight from the browser to Supabase Storage via a signed URL (Vercel caps request bodies at ~4.5 MB).
async function putFile(url, file, contentType) {
  try {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
    return res.ok ? null : 'The file could not be uploaded. Please try again.'
  } catch {
    return 'Upload interrupted. Check your connection and try again.'
  }
}

// Options that upload files (Startup Junction, Startup Arena). `details` is that option's answers,
// sent under `detailKey` ('sj' | 'arena'); `files` maps field -> File.
// Order matters: the server signs each upload, we PUT it, and ONLY THEN is the registration posted, which
// itself re-verifies every object before writing the row. onStep(label) reports progress for the UI.
async function submitWithFiles(option, detailKey, details, files, data, honeypot, onStep) {
  const base = { ...data, option, website: honeypot }
  let submissionId = ''
  const uploaded = {}
  // Any failure before the final save deletes what was already uploaded, so nothing is left behind.
  const abort = async (result) => {
    if (submissionId) await post({ action: 'discard', option, submissionId })
    return result
  }
  for (const [field, file] of Object.entries(files)) {
    onStep(`Uploading ${file.name}…`)
    const signed = await post({
      ...base,
      action: 'upload-url',
      [detailKey]: { stage: details.stage },
      submissionId,
      field,
      filename: file.name,
      size: file.size,
      type: file.type,
    })
    if (signed.status !== 'ok') return abort(signed)
    submissionId = signed.data.submissionId
    const problem = await putFile(signed.data.upload_url, file, signed.data.content_type)
    if (problem) return abort({ status: 'error', message: problem })
    uploaded[field] = file.name.split('.').pop().toLowerCase()
  }
  onStep('Saving your registration…')
  return post({ ...base, [detailKey]: { ...details, submissionId, files: uploaded } })
}

export const submitStartupJunction = (data, sj, files, honeypot = '', onStep = () => {}) =>
  submitWithFiles('startup-junction', 'sj', sj, files, data, honeypot, onStep)

export const submitStartupArena = (data, arena, files, honeypot = '', onStep = () => {}) =>
  submitWithFiles('startup-arena', 'arena', arena, files, data, honeypot, onStep)

// One-on-One Mentorship: a date (yyyy-mm-dd, IST) and a slot id. Several bookings per student are fine.
export const submitMentorship = (data, booking, honeypot = '') =>
  post({ ...data, option: 'mentorship', website: honeypot, mentorship: booking })
