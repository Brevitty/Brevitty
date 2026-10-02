// GET/POST /api/session-progress — the signed-in student's per-session completion + quiz score.
import { allowMethod, readJson } from './_lib/http.js'
import { requireSession } from './_lib/session.js'
import { getSessionProgress, setSessionProgress, isValidSessionId } from './_lib/sessionProgressSheet.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }
  res.setHeader('Cache-Control', 'no-store')

  const session = await requireSession(req, res)
  if (!session) return

  if (req.method === 'GET') {
    try {
      return res.status(200).json({ sessions: await getSessionProgress(session.email) })
    } catch (err) {
      console.error(`[session-progress] ${err.message}`)
      return res.status(503).json({ error: 'Session progress is temporarily unavailable. Please try again in a few minutes.' })
    }
  }

  const body = readJson(req)
  const sessionId = typeof body?.session_id === 'string' ? body.session_id : ''
  const completed = body?.completed
  const quizScore = body?.quiz_score ?? null
  const scoreOk = quizScore === null || (typeof quizScore === 'number' && Number.isFinite(quizScore) && quizScore >= 0 && quizScore <= 100)
  if (typeof completed !== 'boolean' || !scoreOk) {
    return res.status(400).json({ error: 'Invalid session_id, completed, or quiz_score value.' })
  }

  try {
    if (!(await isValidSessionId(sessionId))) return res.status(400).json({ error: 'Invalid session_id, completed, or quiz_score value.' })
    await setSessionProgress(session.email, sessionId, completed, quizScore)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(`[session-progress] ${err.message}`)
    return res.status(503).json({ error: 'Could not save your session progress. Please try again.' })
  }
}
