// Pure rules for the consulting feature: errors, IST dates, slot validation,
// overlap detection. No I/O, so scripts/check-consulting-logic.mjs can assert on it.

import {
  TZ, SLOT_STEP_MIN, DAY_START, DAY_END, DURATIONS_MIN, SESSION_STATUSES, SUBMITTABLE_STATUSES,
} from '../../../src/data/consultingConstants.js'

const MIN_PER_HOUR = 60
const IST_OFFSET = '+05:30'
const MS_PER_DAY = 86_400_000
const MAX_EMAIL_CHARS = 254
const MAX_LINK_CHARS = 2000

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
export const fail = (status, message) => {
  throw new ApiError(status, message)
}

/* ---------------- dates & times (all Asia/Kolkata) ---------------- */

export const istToday = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: TZ })

export const isDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * MIN_PER_HOUR + m
}
export const fromMin = (min) =>
  `${String(Math.floor(min / MIN_PER_HOUR)).padStart(2, '0')}:${String(min % MIN_PER_HOUR).padStart(2, '0')}`

export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * MS_PER_DAY).toISOString().slice(0, 10)

/* ---------------- slots ---------------- */

// Returns an error string, or '' when {date,start_time,end_time} is a bookable slot.
export function slotError({ date, start_time, end_time }) {
  if (!isDate(date)) return 'date must be YYYY-MM-DD.'
  if (!isTime(start_time) || !isTime(end_time)) return 'start_time and end_time must be HH:mm (24h).'
  const start = toMin(start_time)
  const end = toMin(end_time)
  if (start % SLOT_STEP_MIN !== 0) return `start_time must be on a ${SLOT_STEP_MIN}-minute slot.`
  if (start < toMin(DAY_START) || end > toMin(DAY_END)) return `Sessions run ${DAY_START}–${DAY_END} IST.`
  if (!DURATIONS_MIN.includes(end - start)) return `Duration must be ${DURATIONS_MIN.join(', ')} minutes.`
  return ''
}

export const overlaps = (a, b) =>
  a.date === b.date && toMin(a.start_time) < toMin(b.end_time) && toMin(b.start_time) < toMin(a.end_time)

// First non-cancelled session (other than `ignoreId`) that collides with `slot`, else null.
export const findConflict = (slot, sessions, ignoreId = '') =>
  sessions.find((s) => s.status !== 'cancelled' && s.session_id !== ignoreId && overlaps(slot, s)) ?? null

export const byDateTime = (a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`)

/* ---------------- student input after a session ---------------- */

export const sessionEndMs = (s) => Date.parse(`${s.date}T${s.end_time}:00${IST_OFFSET}`)
export const sessionOver = (s, now = Date.now()) => sessionEndMs(s) <= now

// Why a student can't file minutes/deliverables for this session yet, or '' when they can.
// Tasks are exempt on purpose: prep tasks can be set on an upcoming session.
export function inputBlockedReason(s, now = Date.now()) {
  if (!SUBMITTABLE_STATUSES.includes(s.status)) return 'This session was cancelled or missed, so there is nothing to submit for it.'
  if (!sessionOver(s, now)) return 'You can add this once the session has ended.'
  return ''
}

// Flag columns (no_tasks, archived, ...) hold 'TRUE' or ''.
export const isFlag = (v) => String(v ?? '').trim().toUpperCase() === 'TRUE'
export const FLAG_ON = 'TRUE'

// rescheduled_from is 'date|start|end'; { date, start_time, end_time } or null when unset/garbled.
export const slotToken = (s) => `${s.date}|${s.start_time}|${s.end_time}`
export function parseSlotToken(v) {
  const [date, start_time, end_time] = String(v ?? '').split('|')
  return isDate(date) && isTime(start_time) && isTime(end_time) ? { date, start_time, end_time } : null
}

/* ---------------- field validation ---------------- */

export const sameEmail = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

export function cleanEmail(v) {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (!e || e.length > MAX_EMAIL_CHARS || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail(400, 'A valid email is required.')
  return e
}

// Trimmed string field; '' when absent unless `required`.
export function cleanText(v, label, { required = false, max = 200 } = {}) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (required && !s) fail(400, `${label} is required.`)
  if (s.length > max) fail(400, `${label} is too long (max ${max} characters).`)
  return s
}

export function cleanDate(v, label, { required = false } = {}) {
  if (v === undefined || v === null || v === '') return required ? fail(400, `${label} is required.`) : ''
  if (!isDate(v)) fail(400, `${label} must be YYYY-MM-DD.`)
  return v
}

export function cleanEnum(v, allowed, label) {
  if (!allowed.includes(v)) fail(400, `${label} must be one of: ${allowed.join(', ')}.`)
  return v
}

export function cleanLink(v, { required = false } = {}) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return required ? fail(400, 'link is required.') : ''
  let ok = false
  try {
    ok = ['http:', 'https:'].includes(new URL(s).protocol)
  } catch {
    /* falls through to the error below */
  }
  if (!ok || s.length > MAX_LINK_CHARS) fail(400, 'link must be a valid http(s) URL.')
  return s
}

export const cleanSessionStatus = (v) => cleanEnum(v, SESSION_STATUSES, 'status')
