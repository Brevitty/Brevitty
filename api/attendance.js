// GET /api/attendance — the signed-in student's attendance, cross-referenced
// against the session list in code (dates/titles live in code, not the sheet).
import { allowMethod } from './_lib/http.js'
import { requireSession } from './_lib/session.js'
import { getAttendance } from './_lib/attendanceSheet.js'
import { SESSIONS } from '../src/data/mockJunctionDashboard.js'

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'GET')) return
  res.setHeader('Cache-Control', 'no-store')

  const session = await requireSession(req, res)
  if (!session) return

  let heldIds, presentById
  try {
    ;({ heldIds, presentById } = await getAttendance(session.email))
  } catch (err) {
    console.error(`[attendance] ${err.message}`)
    return res.status(503).json({ error: 'Attendance is temporarily unavailable. Please try again in a few minutes.' })
  }

  const sessions = SESSIONS.map((s) => {
    const held = heldIds.has(s.id)
    return { session_id: s.id, held, present: held ? presentById.get(s.id) : null }
  })
  const heldSessions = sessions.filter((s) => s.held)

  return res.status(200).json({
    sessions,
    held_count: heldSessions.length,
    present_count: heldSessions.filter((s) => s.present).length,
  })
}
