// Client-side helpers for the public /register pages: applicant prefill, validation, and the API calls.
// Each option page is ONE complete form that sends everything in a single request; the only thing kept in
// sessionStorage is a convenience prefill of the applicant fields, so registering for a second option
// doesn't mean retyping them. Nothing is stored server-side until a form is submitted.
import { VERIFIED_CAMPUSES, OTHER_CAMPUS, EMAIL_RE, PHONE_RE, normalisePhone, needsDepartment } from '../data/registrationOptions.js'

const STORAGE_KEY = 'brevitty.applicant.v1'

export const EMPTY_APPLICANT = {
  name: '',
  email: '',
  phone: '',
  collegeStudent: '', // 'Yes' | 'No'
  campus: '',
  studentEmail: '',
  department: '',
  course: '',
  semester: '',
}

/* ---- prefill (sessionStorage; cleared when the tab closes) ---- */

// A campus without departments (GCEC) must never carry a department over from an earlier campus choice.
export const withoutStaleDepartment = (a) => (needsDepartment(a.campus) ? a : { ...a, department: '' })

export function loadApplicant() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    return withoutStaleDepartment({ ...EMPTY_APPLICANT, ...(saved && typeof saved === 'object' ? saved : {}) })
  } catch {
    return { ...EMPTY_APPLICANT } // private mode / blocked storage / corrupt value
  }
}
export function saveApplicant(applicant) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(applicant))
  } catch {
    /* storage unavailable: forms still work, they just won't prefill */
  }
}

/* ---- validation (mirrors api/register.js) ---- */

export const isEmail = (v) => EMAIL_RE.test(String(v).trim())
export const isPhone = (v) => PHONE_RE.test(normalisePhone(String(v).trim()))
// One of Poornima University, GCEC, PCE, PIET: these students also give a student email, department, course and semester.
export const isStudentCampus = (campus) => VERIFIED_CAMPUSES.includes(campus)

// -> { field: message }. `gated` = Startup Junction / Arena: the eligibility gate already established a student
// at one of the four campuses, so the Yes/No question is not asked and "Others" is not allowed.
export function applicantErrors(a, { gated = false } = {}) {
  const e = {}
  if (a.name.trim().length < 2) e.name = 'Enter your full name.'
  if (!isEmail(a.email)) e.email = 'Enter a valid email address.'
  if (!isPhone(a.phone)) e.phone = 'Enter a 10-digit mobile number.'
  if (!gated && !a.collegeStudent) e.collegeStudent = 'Tell us if you are a college student.'
  const student = gated || a.collegeStudent === 'Yes'
  if (student) {
    const allowed = gated ? VERIFIED_CAMPUSES : [...VERIFIED_CAMPUSES, OTHER_CAMPUS]
    if (!allowed.includes(a.campus)) e.campus = 'Choose your campus.'
  }
  if (student && isStudentCampus(a.campus)) {
    // Required here; format only, the domain is never checked (the form shows a soft hint instead).
    if (!isEmail(a.studentEmail)) e.studentEmail = 'Enter your student email.'
    if (needsDepartment(a.campus) && !a.department.trim()) e.department = 'Enter your department.'
    if (!a.course.trim()) e.course = 'Enter your course.'
    if (!a.semester.trim()) e.semester = 'Enter your semester.'
  }
  return e
}

// The exact applicant fields sent to the API: trimmed, normalised, and cleared of anything that doesn't apply.
export function applicantPayload(a, { gated = false } = {}) {
  const student = gated || a.collegeStudent === 'Yes'
  const verified = student && isStudentCampus(a.campus)
  return {
    name: a.name.trim(),
    email: a.email.trim().toLowerCase(),
    phone: normalisePhone(a.phone.trim()),
    collegeStudent: student ? 'Yes' : 'No',
    campus: student ? a.campus : '',
    studentEmail: verified ? a.studentEmail.trim().toLowerCase() : '',
    department: verified && needsDepartment(a.campus) ? a.department.trim() : '',
    course: verified ? a.course.trim() : '',
    semester: verified ? a.semester.trim() : '',
  }
}

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

// Competitions and Grants: the applicant fields only.
export const submitRegistration = (option, applicant, honeypot = '') => post({ ...applicant, option, website: honeypot })

// Straight from the browser to Supabase Storage via a signed URL (Vercel caps request bodies at ~4.5 MB).
async function putFile(url, file, contentType) {
  try {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
    return res.ok ? null : 'The file could not be uploaded. Please try again.'
  } catch {
    return 'Upload interrupted. Check your connection and try again.'
  }
}

// Options that upload files (Startup Junction, Startup Arena). `details` is that option's answers, sent under
// `detailKey` ('sj' | 'arena'); `files` maps field -> File.
// Order matters: the server signs each upload, we PUT it, and ONLY THEN is the registration posted, which
// itself re-verifies every object before writing the row. onStep(label) reports progress for the UI.
async function submitWithFiles(option, detailKey, details, files, applicant, honeypot, onStep) {
  const base = { ...applicant, option, website: honeypot }
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

export const submitStartupJunction = (applicant, sj, files, honeypot = '', onStep = () => {}) =>
  submitWithFiles('startup-junction', 'sj', sj, files, applicant, honeypot, onStep)

export const submitStartupArena = (applicant, arena, files, honeypot = '', onStep = () => {}) =>
  submitWithFiles('startup-arena', 'arena', arena, files, applicant, honeypot, onStep)

// One-on-One Mentorship: a date (yyyy-mm-dd, IST) and a slot id. Several bookings per student are fine.
export const submitMentorship = (applicant, booking, honeypot = '') =>
  post({ ...applicant, option: 'mentorship', website: honeypot, mentorship: booking })
