// GET /api/documents — the signed-in student's document statuses. Read-only; uploads are out of scope.
import { allowMethod } from './_lib/http.js'
import { requireSession } from './_lib/session.js'
import { getDocuments } from './_lib/documentsSheet.js'

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'GET')) return
  res.setHeader('Cache-Control', 'no-store')

  const session = await requireSession(req, res)
  if (!session) return

  try {
    return res.status(200).json({ documents: await getDocuments(session.email) })
  } catch (err) {
    console.error(`[documents] ${err.message}`)
    return res.status(503).json({ error: 'Documents are temporarily unavailable. Please try again in a few minutes.' })
  }
}
