// Pure helpers for Hub redirects. No React, no network.
import { getPillar, getPillarBySlug, pillarHref } from '../data/hubPillars.js'

export const approvedOf = (memberships) => memberships.filter((m) => m.status === 'approved')

// Where a freshly signed-in account should land: straight into its workspace when it has
// exactly one, otherwise the My workspace page (/hub/choose) listing them all.
export function landingPath(memberships) {
  if (!memberships.length) return '/hub/none'
  const approved = approvedOf(memberships)
  if (!approved.length) return '/hub/status'
  const only = approved.length === 1 ? getPillar(approved[0].pillar) : null
  return (only && pillarHref(only)) || '/hub/choose'
}

// Open-redirect protection: only same-site absolute paths. Anything else -> null.
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/')) return null
  if (next.startsWith('//') || next.startsWith('/\\')) return null // protocol-relative (browsers treat \ as /)
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(next) || next.includes('://')) return null
  return next
}

const LANDING_STATES = ['choose', 'status', 'none']

// May this account open `path`? Only /hub/<pillar> needs approval; the landing-state
// pages are always fine (HubGate/landingPath sort out the rest).
function canAccess(path, memberships) {
  const segments = path.split(/[?#]/)[0].split('/').filter(Boolean)
  if (segments[0] !== 'hub' || segments.length < 2) return true
  if (LANDING_STATES.includes(segments[1])) return true
  const pillar = getPillarBySlug(segments[1])
  return Boolean(pillar) && memberships.some((m) => m.pillar === pillar.id && m.status === 'approved')
}

// ?next= wins only if valid AND the account can open it; otherwise the normal landing.
export function destinationAfterLogin(next, memberships) {
  const safe = safeNext(next)
  if (safe && safe !== '/hub' && canAccess(safe, memberships)) return safe
  return landingPath(memberships)
}
