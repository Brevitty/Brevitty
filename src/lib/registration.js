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

// -> { status: 'ok' | 'already' | 'error', message }
export async function submitRegistration(option, data, honeypot = '') {
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, option, website: honeypot }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return { status: 'ok' }
    if (res.status === 409) return { status: 'already', message: json.error }
    return { status: 'error', message: json.error || 'Something went wrong. Please try again.' }
  } catch {
    return { status: 'error', message: 'Could not reach the server. Check your connection and try again.' }
  }
}
