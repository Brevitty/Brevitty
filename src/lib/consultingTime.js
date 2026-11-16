// IST display + scheduling helpers for the consulting UI. Slot rules are the
// server's own (api/_lib/consulting/rules.js is pure, no Node deps), so the
// grid the admin sees can never disagree with what the API accepts.
import { TZ, SLOT_STEP_MIN, DAY_START, DAY_END } from '../data/consultingConstants.js'
import {
  istToday, toMin, fromMin, overlaps, addDays, byDateTime, sessionEndMs, inputBlockedReason, parseSlotToken,
} from '../../api/_lib/consulting/rules.js'

export { istToday, toMin, fromMin, addDays, byDateTime, inputBlockedReason, parseSlotToken }
// The one set of "what is missing" rules (also used by the admin summary API).
export { isFinished, studentItems, sirItems, waitingOnSir } from '../../api/_lib/consulting/missing.js'

const IST_OFFSET = '+05:30'
const MS_PER_MIN = 60_000

export const startsAt = (s) => new Date(`${s.date}T${s.start_time}:00${IST_OFFSET}`)
export const endsAt = (s) => new Date(sessionEndMs(s))
export const durationMin = (s) => toMin(s.end_time) - toMin(s.start_time)

// Upcoming = still scheduled and not over yet. Everything else is history.
export const isUpcoming = (s, now = new Date()) => s.status === 'scheduled' && endsAt(s) > now

const fmt = (iso, opts) => new Date(`${iso}T12:00:00${IST_OFFSET}`).toLocaleDateString('en-IN', { timeZone: TZ, ...opts })
export const fmtDate = (iso) => (iso ? fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
export const fmtDay = (iso) => (iso ? fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }) : '')
export const fmtWeekday = (iso) => fmt(iso, { weekday: 'long' })
export const fmtMonth = (iso) => fmt(iso, { month: 'short' }).toUpperCase()
export const fmtDayNum = (iso) => iso.slice(8, 10)

// 24h HH:mm -> "4:30 PM"
export function fmtTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
export const fmtRange = (s) => `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`

// Whole days from IST today to `iso` (negative = past).
export const daysFromToday = (iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${istToday()}T00:00:00Z`)) / 86_400_000)

export function relativeDay(iso) {
  const d = daysFromToday(iso)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  return d > 0 ? `In ${d} days` : `${-d} days ago`
}

// Morning / afternoon / evening by the IST clock.
export function greeting(now = new Date()) {
  const h = Number(now.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function countdown(target, now = new Date()) {
  const total = Math.max(0, Math.floor((target - now) / MS_PER_MIN))
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60, done: total === 0 }
}

// Start times on the 30-min grid, each flagged if a `durationMin` session there
// would run past the day end, clash with a live session, or already be in the past.
export function slotGrid(date, durationMin, sessions, ignoreId = '') {
  const live = sessions.filter((s) => s.status !== 'cancelled' && s.session_id !== ignoreId)
  const nowMin = date === istToday() ? toMin(new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })) : -1
  const slots = []
  for (let m = toMin(DAY_START); m < toMin(DAY_END); m += SLOT_STEP_MIN) {
    const slot = { date, start_time: fromMin(m), end_time: fromMin(m + durationMin) }
    const clash = live.find((s) => overlaps(slot, s))
    const reason = m + durationMin > toMin(DAY_END) ? 'Too late' : clash ? 'Booked' : m <= nowMin ? 'Passed' : ''
    slots.push({ ...slot, reason, clash })
  }
  return slots
}
