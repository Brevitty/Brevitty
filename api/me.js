import { allowMethod } from './_lib/http.js'
import { currentIdentity } from './_lib/signIn.js'

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'GET')) return
  res.setHeader('Cache-Control', 'no-store') // account state must never be cached
  const identity = await currentIdentity(req)
  if (!identity) return res.status(401).json({ error: 'Not signed in.' })
  // Explicit fields only (currentIdentity builds them): never the password or a session fingerprint.
  return res.status(200).json(identity)
}
