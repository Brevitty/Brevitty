import { allowMethod, readJson, clientIp, makeRateLimiter } from './_lib/http.js'
import { findStudent } from './_lib/roster.js'
import { safeEqual, sessionConfigured, setSessionCookie } from './_lib/session.js'

const MAX_EMAIL_CHARS = 254
const MAX_PASSWORD_CHARS = 256
const GENERIC_ERROR = 'Invalid email or password'
const UNAVAILABLE_ERROR = 'Sign-in is temporarily unavailable. Please try again in a few minutes.'

// 10 attempts / 60s per IP, in-memory (resets on cold start — see api/generate.js).
const limited = makeRateLimiter(10, 60_000)

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'POST')) return

  if (limited(clientIp(req))) {
    return res.status(429).json({ error: 'Too many attempts. Give it a minute and try again.' })
  }
  if (!sessionConfigured()) {
    return res.status(500).json({ error: 'Sign-in is not configured on the server.' })
  }

  const body = readJson(req)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password || email.length > MAX_EMAIL_CHARS || password.length > MAX_PASSWORD_CHARS) {
    return res.status(401).json({ error: GENERIC_ERROR })
  }

  let student
  try {
    student = await findStudent(email)
  } catch {
    // roster.js already logged the cause; keep this line free of emails/passwords/Google bodies
    console.error('login: roster unavailable')
    return res.status(503).json({ error: UNAVAILABLE_ERROR })
  }
  // Compare against a dummy when the email is unknown so timing doesn't reveal it.
  const ok = safeEqual(password, student ? student.password : '\0') && student !== null
  if (!ok) return res.status(401).json({ error: GENERIC_ERROR })

  setSessionCookie(req, res, student.email, student.password)
  return res.status(200).json({ ok: true, email: student.email })
}
