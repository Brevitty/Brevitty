// GET /api/mentor-assignments — the signed-in student's own mentor assignments. Read-only.
import { allowMethod } from './_lib/http.js'
import { requireSession } from './_lib/session.js'
import { getMentorAssignments } from './_lib/mentorAssignmentsSheet.js'

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'GET')) return
  res.setHeader('Cache-Control', 'no-store')

  const session = await requireSession(req, res)
  if (!session) return

  try {
    return res.status(200).json({ assignments: await getMentorAssignments(session.email) })
  } catch (err) {
    console.error(`[mentor-assignments] ${err.message}`)
    return res.status(503).json({ error: 'Mentor assignments are temporarily unavailable. Please try again in a few minutes.' })
  }
}
