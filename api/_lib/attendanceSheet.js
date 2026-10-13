// Attendance tab (long format): email | session_id | date | status. One row per student per cohort
// session; status "present" counts as attended, anything else as absent. Held = the cohort
// session's date has passed. Columns are read by header name. Marking is Hub Admin only (hub.js).
import { allRows, rowsFor, warm } from './pillarStore.js'
import { sheetsRequest, invalidateTab } from './sheetsClient.js'
import { getCohortSessions } from './dashboardSheet.js'
import { membershipsOf } from './roster.js'
import { STUDENTS_TAB } from './hubAdmin.js'
import { isDemoEmail } from './accounts.js'
import { fail, sameEmail } from './consulting/rules.js'

const TAB = 'Attendance'
const PRESENT = 'present'
const ABSENT = 'absent'
const MARKS = [PRESENT, ABSENT]
const MAX_MARKS = 500
const lc = (v) => String(v ?? '').trim().toLowerCase()

export async function getAttendanceSummary(email) {
  const [rows, cohortSessions] = await Promise.all([rowsFor(TAB, email), getCohortSessions(email)])
  const presentIds = new Set(rows.filter((r) => lc(r.status) === PRESENT).map((r) => r.session_id))
  const sessions = cohortSessions.map((s) => {
    const held = s.status === 'past'
    return { session_id: s.id, held, present: held ? presentIds.has(s.id) : null }
  })
  const held = sessions.filter((s) => s.held)
  return { sessions, held_count: held.length, present_count: held.filter((s) => s.present).length }
}

/* ---------------- Hub Admin: mark attendance ---------------- */

// Real Startup Junction founders only: an approved startup membership, never a demo account.
async function realFounders() {
  await warm([STUDENTS_TAB, TAB])
  return (await allRows(STUDENTS_TAB))
    .filter((s) => s.email && !isDemoEmail(s.email) && membershipsOf(s.memberships).some((m) => m.pillar === 'startup' && m.status === 'approved'))
    .map((s) => ({ email: s.email, name: s.name || s.email }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function adminAttendanceSessions() {
  const sessions = await getCohortSessions()
  return { sessions: sessions.map((s) => ({ id: s.id, date: s.date, time: s.time, topic: s.topic, held: s.status === 'past' })) }
}

export async function adminAttendanceRoster(sessionId) {
  const session = (await getCohortSessions()).find((s) => s.id === sessionId) || fail(404, 'Session not found.')
  const [founders, rows] = await Promise.all([realFounders(), allRows(TAB)])
  const mark = new Map(rows.filter((r) => r.session_id === sessionId).map((r) => [lc(r.email), lc(r.status)]))
  return {
    session: { id: session.id, date: session.date, topic: session.topic, held: session.status === 'past' },
    students: founders.map((f) => ({ ...f, status: mark.get(lc(f.email)) || '' })),
  }
}

// body: { session_id, marks: [{ email, status: 'present' | 'absent' }] }. Past sessions can be edited.
// One read, then one batched update plus one append, so a whole class saves in two writes.
export async function saveAttendance(body) {
  const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
  const session = (await getCohortSessions()).find((s) => s.id === sessionId) || fail(404, 'Session not found.')
  if (!Array.isArray(body.marks) || !body.marks.length || body.marks.length > MAX_MARKS) fail(400, 'marks must be a non-empty list.')
  const founders = await realFounders()
  const marks = new Map()
  for (const m of body.marks) {
    const email = typeof m?.email === 'string' ? m.email.trim() : ''
    const founder = founders.find((f) => sameEmail(f.email, email)) || fail(400, `${email || 'A student'} is not a Startup Junction founder.`)
    if (!MARKS.includes(m.status)) fail(400, 'status must be present or absent.')
    marks.set(founder.email, m.status)
  }

  const values = (await sheetsRequest(`/values/${encodeURIComponent(`'${TAB}'`)}!A:Z`)).values || []
  const header = (values[0] || []).map((h) => String(h).trim())
  const col = (name) => header.indexOf(name)
  for (const need of ['email', 'session_id', 'date', 'status']) if (col(need) < 0) throw new Error(`Attendance tab is missing the ${need} column`)
  const line = (email, status) => header.map((h) => ({ email, session_id: sessionId, date: session.date, status })[h] ?? '')
  const colLetter = (i) => String.fromCharCode(65 + i)
  const updates = []
  const appends = []
  const seen = new Set()
  values.slice(1).forEach((r, i) => {
    if (String(r[col('session_id')] ?? '').trim() !== sessionId) return
    const email = [...marks.keys()].find((e) => sameEmail(e, String(r[col('email')] ?? '')))
    if (!email || seen.has(email)) return
    seen.add(email)
    updates.push({ range: `'${TAB}'!A${i + 2}:${colLetter(header.length - 1)}${i + 2}`, values: [line(email, marks.get(email))] })
  })
  for (const [email, status] of marks) if (!seen.has(email)) appends.push(line(email, status))

  if (updates.length) await sheetsRequest('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: updates }) })
  if (appends.length) {
    await sheetsRequest(`/values/${encodeURIComponent(`'${TAB}'`)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: appends }) })
  }
  invalidateTab(TAB)
  return adminAttendanceRoster(sessionId)
}
