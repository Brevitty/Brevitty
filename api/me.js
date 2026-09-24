import { allowMethod } from './_lib/http.js'
import { requireSession } from './_lib/session.js'

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'GET')) return
  res.setHeader('Cache-Control', 'no-store') // account state must never be cached
  const session = await requireSession(req, res)
  if (!session) return
  // Explicit fields only: never the password or the session fingerprint.
  return res.status(200).json({
    email: session.email,
    name: session.name,
    memberships: session.memberships,
  })
}
