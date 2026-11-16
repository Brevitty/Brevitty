import crypto from 'crypto'
import { allowMethod, readJson, clientIp, makeRateLimiter } from './_lib/http.js'
import {
  REG_TABS,
  REG_HEADERS,
  MENTORSHIP_STATUS_DEFAULT,
  registeredEmails,
  bookedMentorshipKeys,
  appendRegRow,
} from './_lib/registrationSheet.js'
import {
  createRegistrationUpload,
  verifyRegistrationFiles,
  removeRegistrationFiles,
  isFileOption,
  isSubmissionId,
} from './_lib/registrationFiles.js'
import {
  OPTION_IDS,
  VERIFIED_CAMPUSES,
  OTHER_CAMPUS,
  OPEN_OPTIONS,
  LIMITS,
  EMAIL_RE,
  PHONE_RE,
  normalisePhone,
  isHttpUrl,
  STAGES,
  isFullStage,
  INDUSTRIES,
  NOT_REGISTERED,
  REGISTERED_WITH,
  MAX_TEAM_SIZE,
  FILE_KINDS,
  OPTION_FILE_FIELDS,
  findSlot,
  isMentorshipDate,
  weekdayName,
  sheetDateSerial,
} from '../src/data/registrationOptions.js'

// Public endpoint (no login). One function (the project is capped at 12), several actions:
//   (default)            append one row to the option's tab
//   action: "upload-url" Startup Junction / Startup Arena: sign a direct-to-storage upload URL for one file
//   action: "discard"    delete a submission's uploaded files after a failed attempt
// Abuse controls: honeypot, per-IP rate limits (in-memory, reset on cold start like login.js),
// hard length caps, server-side re-validation of everything the forms check.
const limitedRegister = makeRateLimiter(8, 60_000)
const limitedUpload = makeRateLimiter(15, 60_000) // up to 3 files + retries per registration

const HONEYPOT_FIELD = 'website' // hidden input on the forms; humans never fill it
const SJ = 'startup-junction'
const ARENA = 'startup-arena'
const MENTORSHIP = 'mentorship'
// Where each option's extra answers live in the request body.
const DETAIL_KEY = { [SJ]: 'sj', [ARENA]: 'arena', [MENTORSHIP]: 'mentorship' }

const MSG = {
  rate: 'Too many attempts. Give it a minute and try again.',
  invalid: 'Please check your details and try again.',
  already: "You're already registered for this one. We'll be in touch!",
  slotTaken: "You've already booked this date and slot. Pick another slot or date.",
  badDate: "That date isn't available. Please pick another one.",
  unavailable: 'Registration is temporarily unavailable. Please try again in a few minutes.',
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0009\u000b-\u001f\u007f]/g // keeps \n for the long description
const oneLine = (v, max) => (typeof v === 'string' ? v.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim() : '').slice(0, max)
const multiLine = (v, max) =>
  (typeof v === 'string' ? v.replace(CONTROL_CHARS, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '').slice(0, max)
const tooLong = (v, max) => typeof v === 'string' && v.trim().length > max

const istTimestamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }) // "2026-11-16 18:30:05"
const fail = (res, status, error, extra = {}) => res.status(status).json({ ok: false, error, ...extra })

/* ---------------- identity + campus (shared by every option) ---------------- */

// Returns { error } or { option, row, verified } — never throws, so a bad payload is a clean 400.
function validateIdentity(body) {
  const caps = [
    [body.name, LIMITS.name], [body.email, LIMITS.email], [body.studentEmail, LIMITS.email],
    [body.department, LIMITS.field], [body.course, LIMITS.field],
    [body.semester, LIMITS.semester], [body.campus, LIMITS.campusText], [body.phone, 20],
  ]
  if (caps.some(([v, max]) => tooLong(v, max))) return { error: MSG.invalid }

  const option = oneLine(body.option, 40)
  const name = oneLine(body.name, LIMITS.name)
  const email = oneLine(body.email, LIMITS.email).toLowerCase()
  const phone = normalisePhone(oneLine(body.phone, 20))
  if (!OPTION_IDS.includes(option) || name.length < 2 || !EMAIL_RE.test(email) || !PHONE_RE.test(phone)) return { error: MSG.invalid }

  const collegeStudent = body.collegeStudent === true || body.collegeStudent === 'Yes'
  const campus = collegeStudent ? oneLine(body.campus, LIMITS.campusText) : ''
  if (collegeStudent && ![...VERIFIED_CAMPUSES, OTHER_CAMPUS].includes(campus)) return { error: MSG.invalid }

  const studentEmail = oneLine(body.studentEmail, LIMITS.email).toLowerCase()
  const row = { name, email, phone, collegeStudent, campus, studentEmail: '', department: '', course: '', semester: '' }

  // Verified = one of the four campuses AND a student email. Then the Step-2 fields are mandatory.
  // (The student email's domain is never checked: the form only shows a soft hint.)
  const verified = VERIFIED_CAMPUSES.includes(campus) && Boolean(studentEmail)
  if (verified) {
    const department = oneLine(body.department, LIMITS.field)
    const course = oneLine(body.course, LIMITS.field)
    const semester = oneLine(body.semester, LIMITS.semester)
    if (!EMAIL_RE.test(studentEmail) || !department || !course || !semester) return { error: MSG.invalid }
    Object.assign(row, { studentEmail, department, course, semester })
  } else if (studentEmail) {
    if (!EMAIL_RE.test(studentEmail)) return { error: MSG.invalid }
    row.studentEmail = studentEmail
  }

  // Startup Junction / Arena are for verified campus students only.
  if (!verified && !OPEN_OPTIONS.includes(option)) return { error: MSG.invalid }
  return { option, row, verified }
}

/* ---------------- shared: the files a submission claims to have uploaded ---------------- */

// -> { files } where files maps field -> extension, or { error }.
function claimedFiles(option, raw) {
  const files = {}
  for (const field of OPTION_FILE_FIELDS[option]) {
    const ext = oneLine(raw?.[field], 5).toLowerCase()
    if (!Object.hasOwn(FILE_KINDS[field].types, ext)) return { error: MSG.invalid }
    files[field] = ext
  }
  return { files }
}

/* ---------------- Startup Junction details (the On-Boarding Form) ---------------- */

// Returns { error } or { sj }. `sj.files` maps field -> extension for the full stages.
function validateStartupJunction(raw) {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null
  if (!s) return { error: MSG.invalid }
  const stage = oneLine(s.stage, 40)
  if (!STAGES.some((x) => x.value === stage)) return { error: MSG.invalid }

  const startupName = oneLine(s.startupName, LIMITS.startupName)
  const oneLiner = oneLine(s.oneLiner, LIMITS.oneLiner)
  if (tooLong(s.startupName, LIMITS.startupName) || tooLong(s.oneLiner, LIMITS.oneLiner)) return { error: MSG.invalid }

  // Stages 1-2: only these three, both optional. Anything else sent is ignored.
  if (!isFullStage(stage)) return { sj: { stage, startupName, oneLiner, full: false } }

  const industry = oneLine(s.industry, 60)
  const description = multiLine(s.description, LIMITS.description)
  const startupEmail = oneLine(s.startupEmail, LIMITS.email).toLowerCase()
  let website = oneLine(s.website, LIMITS.website)
  const incubatedElsewhere = s.incubatedElsewhere === 'Yes' ? 'Yes' : s.incubatedElsewhere === 'No' ? 'No' : ''
  const incubatedWhere = oneLine(s.incubatedWhere, LIMITS.where)
  const registeredWith = oneLine(s.registeredWith, 40)
  const registrationNumber = oneLine(s.registrationNumber, LIMITS.registrationNumber)
  const founderRole = oneLine(s.founderRole, LIMITS.role)
  const teamSize = Number(s.teamSize)
  const caps = [[s.description, LIMITS.description], [s.website, LIMITS.website], [s.incubatedWhere, LIMITS.where], [s.registrationNumber, LIMITS.registrationNumber], [s.founderRole, LIMITS.role]]
  if (caps.some(([v, max]) => tooLong(v, max))) return { error: MSG.invalid }

  if (!startupName || !oneLiner || !INDUSTRIES.includes(industry) || !description || !EMAIL_RE.test(startupEmail)) return { error: MSG.invalid }
  if (website) {
    if (!isHttpUrl(website)) return { error: MSG.invalid }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(website)) website = `https://${website}`
  }
  if (!incubatedElsewhere || (incubatedElsewhere === 'Yes' && !incubatedWhere)) return { error: MSG.invalid }
  if (!REGISTERED_WITH.includes(registeredWith) || (registeredWith !== NOT_REGISTERED && !registrationNumber)) return { error: MSG.invalid }
  if (!founderRole || !Number.isInteger(teamSize) || teamSize < 1 || teamSize > MAX_TEAM_SIZE) return { error: MSG.invalid }

  // Team Size counts the founder, so N asks for exactly N-1 members, each with a name and a mobile.
  const team = Array.isArray(s.team) ? s.team : []
  if (team.length !== teamSize - 1) return { error: MSG.invalid }
  const members = []
  for (const m of team) {
    const name = oneLine(m?.name, LIMITS.name)
    const mobile = normalisePhone(oneLine(m?.mobile, 20))
    if (name.length < 2 || !PHONE_RE.test(mobile) || tooLong(m?.name, LIMITS.name)) return { error: MSG.invalid }
    members.push({ name, mobile })
  }

  const claimed = claimedFiles(SJ, s.files)
  if (claimed.error) return claimed
  return {
    sj: {
      stage, startupName, oneLiner, industry, description, startupEmail, website, incubatedElsewhere,
      incubatedWhere: incubatedElsewhere === 'Yes' ? incubatedWhere : '',
      registeredWith, registrationNumber: registeredWith === NOT_REGISTERED ? '' : registrationNumber,
      founderRole, teamSize, team: members, files: claimed.files, full: true,
    },
  }
}

// Must follow REG_HEADERS['Startup Junction'] (base columns, then the extras).
function startupJunctionCells(sj, paths) {
  const t = (i, k) => sj.team?.[i]?.[k] ?? ''
  return [
    sj.stage, sj.startupName, sj.oneLiner, sj.industry ?? '', sj.description ?? '', sj.startupEmail ?? '', sj.website ?? '',
    paths?.pitchDeck ?? '', paths?.logo ?? '', sj.incubatedElsewhere ?? '', sj.incubatedWhere ?? '', sj.registeredWith ?? '', sj.registrationNumber ?? '',
    paths?.founderPhoto ?? '', sj.founderRole ?? '', sj.full ? sj.teamSize : '',
    ...[0, 1, 2, 3, 4].flatMap((i) => [t(i, 'name'), t(i, 'mobile')]),
  ]
}

/* ---------------- Startup Arena: name, one-liner, deck, logo ---------------- */

function validateArena(raw) {
  const a = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null
  if (!a) return { error: MSG.invalid }
  if (tooLong(a.startupName, LIMITS.startupName) || tooLong(a.oneLiner, LIMITS.oneLiner)) return { error: MSG.invalid }
  const startupName = oneLine(a.startupName, LIMITS.startupName)
  const oneLiner = oneLine(a.oneLiner, LIMITS.oneLiner)
  // The student must confirm the deck follows the 8-section format.
  if (!startupName || !oneLiner || a.deckConfirmed !== true) return { error: MSG.invalid }
  const claimed = claimedFiles(ARENA, a.files)
  if (claimed.error) return claimed
  return { arena: { startupName, oneLiner, files: claimed.files } }
}

/* ---------------- Mentorship: date + slot (IST) ---------------- */

// Returns { error } or { booking: { date, slot } }.
function validateMentorship(raw) {
  const m = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null
  if (!m) return { error: MSG.invalid }
  const slot = findSlot(oneLine(m.slot, 20))
  if (!slot) return { error: MSG.invalid }
  const date = oneLine(m.date, 10)
  // Upcoming (tomorrow or later), inside the 28-day window, and never a Sunday: all computed in IST.
  if (!isMentorshipDate(date)) return { error: MSG.badDate }
  return { booking: { date, slot } }
}

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const newMentorshipId = (date) =>
  `MEN-${date.replaceAll('-', '')}-${Array.from(crypto.randomBytes(4), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('')}`

// Must follow REG_HEADERS.Mentorship (base columns, then the extras). The date goes in as a day
// serial number: the sheet column is date-formatted, so it is a real date, not text.
function mentorshipCells({ date, slot }) {
  return [newMentorshipId(date), sheetDateSerial(date), weekdayName(date), slot.id, slot.time, MENTORSHIP_STATUS_DEFAULT, '', '']
}

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'POST')) return
  res.setHeader('Cache-Control', 'no-store')

  const body = readJson(req)
  const isUpload = body?.action === 'upload-url'
  const isDiscard = body?.action === 'discard'
  if (body && body.action !== undefined && !isUpload && !isDiscard) return fail(res, 400, MSG.invalid)
  if (!body) return limitedRegister(clientIp(req)) ? fail(res, 429, MSG.rate) : fail(res, 400, MSG.invalid) // unparsable bodies still count against the limit

  // Which upload-taking option (if any) this request is about, and the submission folder it may have filled.
  const fileOption = typeof body.option === 'string' && isFileOption(body.option) ? body.option : ''
  const detail = body[DETAIL_KEY[body.option]]
  const submissionId = [detail?.submissionId, body.submissionId].find(isSubmissionId) || ''

  if (((isUpload || isDiscard) ? limitedUpload : limitedRegister)(clientIp(req))) {
    // A throttled final save must not leave the files it already uploaded behind.
    if (!isUpload && !isDiscard && fileOption && submissionId) await removeRegistrationFiles(fileOption, submissionId)
    return fail(res, 429, MSG.rate)
  }

  // action "discard": the browser gives up mid-upload; delete that submission's files (the uuid is unguessable).
  if (isDiscard) {
    await removeRegistrationFiles(fileOption, submissionId)
    return res.status(200).json({ ok: true })
  }

  // Honeypot: pretend it worked so a bot learns nothing, write nothing.
  if (typeof body[HONEYPOT_FIELD] === 'string' && body[HONEYPOT_FIELD].trim()) return res.status(200).json({ ok: true })

  // From here on, a failed submission removes whatever it uploaded.
  const bail = async (status, error, extra) => {
    if (fileOption && submissionId) await removeRegistrationFiles(fileOption, submissionId)
    return fail(res, status, error, extra)
  }

  const identity = validateIdentity(body)
  if (identity.error) return bail(400, identity.error)
  const { option, row } = identity
  const tab = REG_TABS[option]

  try {
    /* ---- action: upload-url ---- */
    if (isUpload) {
      if (!isFileOption(option)) return fail(res, 400, MSG.invalid)
      // Junction uploads only for the full stages; Arena always has a deck and a logo.
      if (option === SJ && !isFullStage(oneLine(body.sj?.stage, 40))) return fail(res, 400, MSG.invalid)
      if ((await registeredEmails(tab)).has(row.email)) return fail(res, 409, MSG.already, { code: 'already_registered' })
      const data = await createRegistrationUpload({
        option,
        submissionId: body.submissionId,
        field: oneLine(body.field, 20),
        filename: body.filename,
        size: body.size,
        type: typeof body.type === 'string' ? body.type.slice(0, 100) : '',
      })
      return res.status(200).json({ ok: true, data })
    }

    /* ---- default: register ---- */
    let sj = null
    let arena = null
    let booking = null
    if (option === SJ) {
      const r = validateStartupJunction(body.sj)
      if (r.error) return bail(400, r.error)
      sj = r.sj
      if (sj.full && !submissionId) return bail(400, MSG.invalid)
    } else if (option === ARENA) {
      const r = validateArena(body.arena)
      if (r.error) return bail(400, r.error)
      arena = r.arena
      if (!submissionId) return bail(400, MSG.invalid)
    } else if (option === MENTORSHIP) {
      const r = validateMentorship(body.mentorship)
      if (r.error) return bail(400, r.error)
      booking = r.booking
    }

    // One registration per email per tab, except Mentorship: only the same email + date + slot is a duplicate.
    if (booking) {
      const key = `${row.email}|${sheetDateSerial(booking.date)}|${booking.slot.id}`
      if ((await bookedMentorshipKeys()).has(key)) return bail(409, MSG.slotTaken, { code: 'already_registered' })
    } else if ((await registeredEmails(tab)).has(row.email)) {
      return bail(409, MSG.already, { code: 'already_registered' })
    }

    // Every required upload must exist (right type and size) before anything is written.
    let paths = null
    if (sj?.full) paths = await verifyRegistrationFiles(SJ, submissionId, sj.files)
    if (arena) paths = await verifyRegistrationFiles(ARENA, submissionId, arena.files)

    const extra = sj
      ? startupJunctionCells(sj, paths)
      : arena
        ? [arena.startupName, arena.oneLiner, paths.pitchDeck, paths.logo]
        : booking
          ? mentorshipCells(booking)
          : []
    const cells = [
      istTimestamp(), row.name, row.phone, row.email, row.collegeStudent ? 'Yes' : 'No', row.campus, row.studentEmail,
      row.department, row.course, row.semester, tab,
      ...extra,
    ]
    if (cells.length !== REG_HEADERS[tab].length) throw new Error('row/column mismatch')
    await appendRegRow(tab, cells)
    if (sj && !sj.full && submissionId) await removeRegistrationFiles(SJ, submissionId) // minimal stages never keep files
    return res.status(200).json({ ok: true })
  } catch (err) {
    if (err?.status === 400) return bail(400, err.message) // file problems: safe, user-facing text from registrationFiles.js
    console.error(`register: failed (${err.message})`) // no request data in the log line
    return bail(503, MSG.unavailable)
  }
}
