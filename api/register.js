import { allowMethod, readJson, clientIp, makeRateLimiter } from './_lib/http.js'
import { REG_TABS, REG_COLUMNS, registeredEmails, appendRegRow } from './_lib/registrationSheet.js'
import {
  OPTION_IDS,
  VERIFIED_CAMPUSES,
  OTHER_CAMPUS,
  OPEN_OPTIONS,
  LIMITS,
  EMAIL_RE,
  PHONE_RE,
  normalisePhone,
} from '../src/data/registrationOptions.js'

// Public endpoint (no login). Appends one row per (email, option) to the registration sheet.
// Abuse controls: honeypot, per-IP rate limit (in-memory, resets on cold start like login.js),
// hard length caps, server-side re-validation of everything the form checks.
const MAX_REQUESTS = 8
const WINDOW_MS = 60_000
const limited = makeRateLimiter(MAX_REQUESTS, WINDOW_MS)

const HONEYPOT_FIELD = 'website' // hidden input on the form; humans never fill it

const MSG = {
  method: 'Method not allowed.',
  rate: 'Too many attempts. Give it a minute and try again.',
  invalid: 'Please check your details and try again.',
  already: "You're already registered for this one. We'll be in touch!",
  unavailable: 'Registration is temporarily unavailable. Please try again in a few minutes.',
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g
const clean = (v, max) => (typeof v === 'string' ? v.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim() : '').slice(0, max)
const tooLong = (v, max) => typeof v === 'string' && v.trim().length > max

const istTimestamp = () =>
  new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }) // "2026-11-16 18:30:05"

const fail = (res, status, error, extra = {}) => res.status(status).json({ ok: false, error, ...extra })

// Returns { error } or { value } — never throws, so a bad payload is always a clean 400.
function validate(body) {
  const lengthCaps = [
    [body.name, LIMITS.name],
    [body.email, LIMITS.email],
    [body.studentEmail, LIMITS.email],
    [body.campusOfficialEmail, LIMITS.email],
    [body.department, LIMITS.field],
    [body.course, LIMITS.field],
    [body.semester, LIMITS.semester],
    [body.campus, LIMITS.campusText],
    [body.phone, 20],
  ]
  if (lengthCaps.some(([v, max]) => tooLong(v, max))) return { error: MSG.invalid }

  const option = clean(body.option, 40)
  const name = clean(body.name, LIMITS.name)
  const email = clean(body.email, LIMITS.email).toLowerCase()
  const phone = normalisePhone(clean(body.phone, 20))
  if (!OPTION_IDS.includes(option) || name.length < 2 || !EMAIL_RE.test(email) || !PHONE_RE.test(phone)) {
    return { error: MSG.invalid }
  }

  const collegeStudent = body.collegeStudent === true || body.collegeStudent === 'Yes'
  const campus = collegeStudent ? clean(body.campus, LIMITS.campusText) : ''
  if (collegeStudent && ![...VERIFIED_CAMPUSES, OTHER_CAMPUS].includes(campus)) return { error: MSG.invalid }

  const studentEmail = clean(body.studentEmail, LIMITS.email).toLowerCase()
  const row = { name, email, phone, collegeStudent, campus, studentEmail: '', department: '', course: '', semester: '', campusOfficialEmail: '' }

  // Verified = one of the four campuses AND a student email. Then every Step-2 field is mandatory.
  const verified = VERIFIED_CAMPUSES.includes(campus) && Boolean(studentEmail)
  if (verified) {
    const department = clean(body.department, LIMITS.field)
    const course = clean(body.course, LIMITS.field)
    const semester = clean(body.semester, LIMITS.semester)
    const campusOfficialEmail = clean(body.campusOfficialEmail, LIMITS.email).toLowerCase()
    if (!EMAIL_RE.test(studentEmail) || !department || !course || !semester || !EMAIL_RE.test(campusOfficialEmail)) {
      return { error: MSG.invalid }
    }
    Object.assign(row, { studentEmail, department, course, semester, campusOfficialEmail })
  } else if (studentEmail && !EMAIL_RE.test(studentEmail)) {
    return { error: MSG.invalid }
  } else if (studentEmail) {
    row.studentEmail = studentEmail // student email given but campus isn't one of the four: keep it, no Step 2
  }

  // Startup Junction / Arena are for verified campus students only.
  if (!verified && !OPEN_OPTIONS.includes(option)) return { error: MSG.invalid }

  return { value: { option, row } }
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'POST')) return
  res.setHeader('Cache-Control', 'no-store')

  if (limited(clientIp(req))) return fail(res, 429, MSG.rate)

  const body = readJson(req)
  if (!body) return fail(res, 400, MSG.invalid)

  // Honeypot: pretend it worked so a bot learns nothing, write nothing.
  if (typeof body[HONEYPOT_FIELD] === 'string' && body[HONEYPOT_FIELD].trim()) return res.status(200).json({ ok: true })

  const { error, value } = validate(body)
  if (error) return fail(res, 400, error)

  const { option, row } = value
  const tab = REG_TABS[option]
  try {
    if ((await registeredEmails(tab)).has(row.email)) return fail(res, 409, MSG.already, { code: 'already_registered' })

    // Order must match REG_COLUMNS.
    const cells = [
      istTimestamp(),
      row.name,
      row.phone,
      row.email,
      row.collegeStudent ? 'Yes' : 'No',
      row.campus,
      row.studentEmail,
      row.department,
      row.course,
      row.semester,
      row.campusOfficialEmail,
      tab,
    ]
    if (cells.length !== REG_COLUMNS.length) throw new Error('row/column mismatch')
    await appendRegRow(tab, cells)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(`register: failed (${err.message})`) // no request data in the log line
    return fail(res, 503, MSG.unavailable)
  }
}
