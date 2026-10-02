// One sign-in for every Hub workspace (/signin, /startup-junction and /consulting all use it).
// The email is resolved against the Startup Junction roster (Students) AND the consulting
// accounts (Admins, then Consultees); each workspace whose password matches gets its own
// cookie (sj_session / cn_session). A workspace that doesn't match gets its cookie cleared,
// so a stale session from someone else never lingers next to the new one.
//
// Same guarantees as before: fail closed, one generic error, no passwords in logs or
// responses, and both password checks always run so timing doesn't reveal which tabs hold an email.
import { findStudent } from './roster.js'
import { safeEqual, sessionConfigured as sjConfigured, setSessionCookie, clearSessionCookie, sessionStudent } from './session.js'
import { findAccount, sessionConfigured as cnConfigured, startSession, endSession, currentAccount } from './consulting/auth.js'
import { fail, sameEmail } from './consulting/rules.js'
import { PILLARS, isAdminPillar } from '../../src/data/hubPillars.js'
import { ROLES } from '../../src/data/consultingConstants.js'

const PILLAR_ORDER = PILLARS.map((p) => p.id)
export const GENERIC_ERROR = 'Invalid email or password'
const UNAVAILABLE = 'Sign-in is temporarily unavailable. Please try again in a few minutes.'
const NO_PASSWORD = '\0' // compared against when an email isn't in a tab

// -> { student, account }: whichever of the two matched (never both null; that's a 401).
export async function signIn(req, res, email, password) {
  const sjOn = sjConfigured()
  const cnOn = cnConfigured()
  if (!sjOn && !cnOn) fail(500, 'Sign-in is not configured on the server.')

  let student = null
  let account = null
  try {
    ;[student, account] = await Promise.all([sjOn ? findStudent(email) : null, cnOn ? findAccount(email) : null])
  } catch {
    console.error('[signin] account lookup unavailable') // the readers already logged the cause
    fail(503, UNAVAILABLE)
  }

  const sjOk = safeEqual(password, student ? student.password : NO_PASSWORD) && Boolean(student)
  const cnOk = safeEqual(password, account ? account.password : NO_PASSWORD) && Boolean(account)
  if (!sjOk && !cnOk) fail(401, GENERIC_ERROR)

  if (sjOk) setSessionCookie(req, res, student.email, student.password)
  else clearSessionCookie(req, res)
  if (cnOk) startSession(req, res, account)
  else endSession(req, res)
  return { student: sjOk ? student : null, account: cnOk ? account : null }
}

export function signOutEverywhere(req, res) {
  clearSessionCookie(req, res)
  endSession(req, res)
}

// Who is signed in, across both cookies: { email, name, memberships } or null.
// A valid cn_session adds an approved "consulting" membership (the Consultees/Admins tabs are
// the source of truth for it). Admin-only pillars (Hub Admin) are granted ONLY to an email in the
// Admins tab: an "admin:approved" typed into a Students row is ignored. If the two cookies belong to different people, the Startup
// Junction one wins and the consulting one is ignored.
export async function currentIdentity(req) {
  const [student, account] = await Promise.all([sessionStudent(req), currentAccount(req).catch(() => null)])
  const consulting = account && (!student || sameEmail(student.email, account.email)) ? account : null
  if (!student && !consulting) return null

  const memberships = (student?.memberships ?? []).filter((m) => !isAdminPillar(m.pillar) && !(consulting && m.pillar === 'consulting'))
  if (consulting) memberships.push({ pillar: 'consulting', status: 'approved', role: consulting.role })
  if (consulting?.role === ROLES.admin) {
    for (const p of PILLARS.filter((x) => x.adminOnly)) memberships.push({ pillar: p.id, status: 'approved' })
  }
  memberships.sort((a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar)) // cards in hubPillars order
  return {
    email: student?.email ?? consulting.email,
    name: student?.name || consulting?.name || '',
    memberships,
    can_change_password: Boolean(student), // /api/change-password edits the Students tab only
  }
}
