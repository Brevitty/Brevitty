import { allowMethod, readJson, clientIp, makeRateLimiter } from './_lib/http.js'
import { signIn, GENERIC_ERROR } from './_lib/signIn.js'
import { ApiError } from './_lib/consulting/rules.js'

const MAX_EMAIL_CHARS = 254
const MAX_PASSWORD_CHARS = 256

// 10 attempts / 60s per IP, in-memory (resets on cold start — see api/generate.js).
const limited = makeRateLimiter(10, 60_000)

// The Hub sign-in: resolves the user across every workspace tab (see _lib/signIn.js).
export default async function handler(req, res) {
  if (!allowMethod(req, res, 'POST')) return

  if (limited(clientIp(req))) {
    return res.status(429).json({ error: 'Too many attempts. Give it a minute and try again.' })
  }

  const body = readJson(req)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password || email.length > MAX_EMAIL_CHARS || password.length > MAX_PASSWORD_CHARS) {
    return res.status(401).json({ error: GENERIC_ERROR })
  }

  try {
    const { student, account } = await signIn(req, res, email, password)
    return res.status(200).json({ ok: true, email: student?.email ?? account.email })
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message })
    console.error('login: unexpected failure')
    return res.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again in a few minutes.' })
  }
}
