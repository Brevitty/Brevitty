// Consulting sign-in: its own cookie (cn_session) signed with its OWN secret
// (CONSULTING_SESSION_SECRET), same scheme as api/_lib/session.js, so a leak or
// rotation of one never affects the other. The role is NEVER read from the
// cookie: every request re-looks the account up (Admins first, then Consultees)
// and re-checks the password fingerprint, so changing a password in the sheet
// signs that person out everywhere.

import crypto from 'crypto'
import { safeEqual, sessionStudent } from '../session.js'
import { isEnvAdmin } from '../accounts.js'
import { appendSetCookie } from '../http.js'
import { list } from './store.js'
import { fail, sameEmail } from './rules.js'
import { ROLES } from '../../../src/data/consultingConstants.js'

const COOKIE_NAME = 'cn_session'
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60

const MIN_SECRET_LENGTH = 32

const hmac = (label, data) =>
  crypto.createHmac('sha256', process.env.CONSULTING_SESSION_SECRET).update(`${label}:${data}`).digest('base64url')

const parseCookie = (header, name) => {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return ''
}

const isLocalhost = (req) => ['localhost', '127.0.0.1'].includes(String(req.headers.host || '').split(':')[0])

const cookie = (req, value, maxAge) =>
  [`${COOKIE_NAME}=${value}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`, ...(isLocalhost(req) ? [] : ['Secure'])].join('; ')

// Fails closed: without a long-enough dedicated secret nobody can sign in.
export function sessionConfigured() {
  const ok = (process.env.CONSULTING_SESSION_SECRET || '').length >= MIN_SECRET_LENGTH
  if (!ok) console.error(`[consulting] CONSULTING_SESSION_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} chars. Failing closed.`)
  return ok
}

// Admins take precedence if an email is in both tabs.
export async function findAccount(email) {
  const admin = (await list('Admins')).find((a) => sameEmail(a.email, email))
  if (admin) return { role: ROLES.admin, ...admin }
  const student = (await list('Consultees')).find((c) => sameEmail(c.email, email))
  return student ? { role: ROLES.student, ...student } : null
}

export function startSession(req, res, account) {
  const payload = Buffer.from(
    JSON.stringify({ e: account.email, x: Date.now() + SESSION_MAX_AGE_S * 1000, f: hmac('cn-pw', account.password) })
  ).toString('base64url')
  appendSetCookie(res, cookie(req, `${payload}.${hmac('cn-sig', payload)}`, SESSION_MAX_AGE_S))
}

export const endSession = (req, res) => appendSetCookie(res, cookie(req, '', 0))

// The signed-in account ({role, email, name, password, ...}) or null.
export async function currentAccount(req) {
  if (!sessionConfigured()) return null
  const token = parseCookie(req.headers.cookie, COOKIE_NAME)
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  if (!safeEqual(token.slice(dot + 1), hmac('cn-sig', body))) return null
  let p
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof p?.e !== 'string' || typeof p.f !== 'string' || typeof p.x !== 'number' || p.x <= Date.now()) return null
  const account = await findAccount(p.e)
  return account && safeEqual(hmac('cn-pw', account.password), p.f) ? account : null
}

// ADMIN_EMAILS (env) makes an email a consulting admin too: with a consulting account it is promoted,
// and with only a Hub sign-in (Students tab) it gets an admin identity. Passwords are untouched.
async function resolveAccount(req) {
  const account = await currentAccount(req)
  if (account) return isEnvAdmin(account.email) ? { ...account, role: ROLES.admin } : account
  const student = await sessionStudent(req).catch(() => null)
  return student && isEnvAdmin(student.email) ? { role: ROLES.admin, email: student.email, name: student.name || '' } : null
}

// Route guard: level is 'any' | 'student' | 'admin'. 401 signed out, 403 wrong role.
export async function authorize(req, level) {
  const account = await resolveAccount(req)
  if (!account) fail(401, 'Not signed in.')
  if (level !== 'any' && account.role !== level) fail(403, 'You do not have access to this.')
  return account
}
