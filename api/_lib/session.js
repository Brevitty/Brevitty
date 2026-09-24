// Signed-cookie sessions. Cookie value = base64url(JSON{e,x,f}) + "." + HMAC.
//   e = email, x = expiry (ms epoch), f = HMAC fingerprint of the student's CURRENT
//   password. The password itself is never stored in the cookie. Because the
//   fingerprint is re-checked against the roster on every request, changing a
//   password (by the student or by the founder editing the roster) kills every
//   other session for that student.

import crypto from 'crypto'
import { findStudent } from './roster.js'

const COOKIE_NAME = 'sj_session'
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60
const MIN_SECRET_LENGTH = 32

function getSecret() {
  const s = process.env.SESSION_SECRET
  return typeof s === 'string' && s.length >= MIN_SECRET_LENGTH ? s : null
}

export function sessionConfigured() {
  const ok = getSecret() !== null
  if (!ok) {
    console.error(
      `[session] SESSION_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} chars. Failing closed.`
    )
  }
  return ok
}

// Domain-separated HMAC so a fingerprint can never be replayed as a signature.
function hmac(label, data) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${label}:${data}`)
    .digest('base64url')
}

// Timing-safe equality for strings of any length (hash both to fixed size first).
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

function parseCookies(header) {
  const out = {}
  if (typeof header !== 'string') return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}

function isLocalhost(req) {
  const host = String(req.headers.host || '').split(':')[0]
  return host === 'localhost' || host === '127.0.0.1'
}

function cookieString(req, value, maxAge) {
  const attrs = [`${COOKIE_NAME}=${value}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`]
  if (!isLocalhost(req)) attrs.push('Secure')
  return attrs.join('; ')
}

// Call after verifying credentials. Caller must have checked sessionConfigured().
export function setSessionCookie(req, res, email, password) {
  const payload = Buffer.from(
    JSON.stringify({
      e: email,
      x: Date.now() + SESSION_MAX_AGE_S * 1000,
      f: hmac('pw', password),
    })
  ).toString('base64url')
  const token = `${payload}.${hmac('sig', payload)}`
  res.setHeader('Set-Cookie', cookieString(req, token, SESSION_MAX_AGE_S))
}

export function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', cookieString(req, '', 0))
}

function readPayload(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME]
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  if (!safeEqual(token.slice(dot + 1), hmac('sig', body))) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof p.e !== 'string' || typeof p.f !== 'string' || typeof p.x !== 'number') return null
    return p.x > Date.now() ? p : null
  } catch {
    return null
  }
}

// Returns { email, name, memberships } for a valid session; otherwise sends 401 and returns null.
export async function requireSession(req, res) {
  if (sessionConfigured()) {
    const p = readPayload(req)
    if (p) {
      const student = await findStudent(p.e).catch(() => null)
      if (student && safeEqual(hmac('pw', student.password), p.f)) {
        return { email: student.email, name: student.name, memberships: student.memberships }
      }
    }
  }
  res.status(401).json({ error: 'Not signed in.' })
  return null
}

// Server-side role check for Hub workspaces: valid session AND an approved membership
// for `pillar`. Otherwise 401 (not signed in) or 403 (signed in, no access); returns null.
export async function requireMembership(req, res, pillar) {
  const session = await requireSession(req, res)
  if (!session) return null
  const ok = session.memberships.some((m) => m.pillar === pillar && m.status === 'approved')
  if (!ok) {
    res.status(403).json({ error: 'You do not have access to this workspace.' })
    return null
  }
  return session
}
