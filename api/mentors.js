// GET /api/mentors — the full mentor directory. Read-only.
import { allowMethod } from './_lib/http.js'
import { requireSession } from './_lib/session.js'
import { getMentors } from './_lib/mentorsSheet.js'

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'GET')) return
  res.setHeader('Cache-Control', 'no-store')

  const session = await requireSession(req, res)
  if (!session) return

  try {
    return res.status(200).json({ mentors: await getMentors() })
  } catch (err) {
    console.error(`[mentors] ${err.message}`)
    return res.status(503).json({ error: 'Mentors are temporarily unavailable. Please try again in a few minutes.' })
  }
}
