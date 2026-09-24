import { allowMethod, readJson, clientIp, makeRateLimiter } from './_lib/http.js'
import { findStudent, updatePassword } from './_lib/roster.js'
import { requireSession, safeEqual, setSessionCookie } from './_lib/session.js'

const MIN_NEW_PASSWORD = 8
const MAX_NEW_PASSWORD = 100
const MAX_CURRENT_PASSWORD = 256
const UNAVAILABLE_ERROR = 'Sign-in is temporarily unavailable. Please try again in a few minutes.'

// This route verifies a password, so it gets the same brute-force damper as login.
const limited = makeRateLimiter(10, 60_000)

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'POST')) return

  const session = await requireSession(req, res)
  if (!session) return

  if (limited(clientIp(req))) {
    return res.status(429).json({ error: 'Too many attempts. Give it a minute and try again.' })
  }

  const body = readJson(req)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword || currentPassword.length > MAX_CURRENT_PASSWORD) {
    return res.status(400).json({ error: 'Enter your current password.' })
  }
  if (newPassword.length < MIN_NEW_PASSWORD || newPassword.length > MAX_NEW_PASSWORD) {
    return res
      .status(400)
      .json({ error: `New password must be ${MIN_NEW_PASSWORD}–${MAX_NEW_PASSWORD} characters.` })
  }

  let student
  try {
    student = await findStudent(session.email)
  } catch {
    // roster.js already logged the cause; nothing sensitive here
    console.error('change-password: roster unavailable')
    return res.status(503).json({ error: UNAVAILABLE_ERROR })
  }
  if (!student || !safeEqual(currentPassword, student.password)) {
    return res.status(403).json({ error: 'Current password is incorrect.' })
  }

  try {
    await updatePassword(session.email, newPassword)
  } catch {
    console.error('change-password: roster update failed')
    return res.status(503).json({ error: UNAVAILABLE_ERROR })
  }

  // Fingerprint changed, so re-issue the cookie or this student would be signed out.
  setSessionCookie(req, res, session.email, newPassword)
  return res.status(200).json({ ok: true })
}
