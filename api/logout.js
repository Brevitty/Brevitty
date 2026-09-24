import { allowMethod } from './_lib/http.js'
import { clearSessionCookie } from './_lib/session.js'

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'POST')) return
  clearSessionCookie(req, res)
  return res.status(200).json({ ok: true })
}
