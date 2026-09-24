// GET /api/hub/workspace?pillar=<id> — the server-side role check the workspace
// pages must call. Hiding routes in the UI is not access control; this is.
import { allowMethod } from '../_lib/http.js'
import { requireMembership } from '../_lib/session.js'
import { getPillar } from '../../src/data/hubPillars.js'

const MAX_PILLAR_CHARS = 32

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'GET')) return
  res.setHeader('Cache-Control', 'no-store')

  // req.query exists on Vercel but not in the dev bridge, so parse the URL.
  const raw = new URL(req.url || '', 'http://localhost').searchParams.get('pillar') || ''
  const pillarId = raw.length <= MAX_PILLAR_CHARS ? raw : ''

  // Unknown pillars simply have no approved membership, so they get the same 403.
  const session = await requireMembership(req, res, pillarId)
  if (!session) return

  const pillar = getPillar(pillarId)
  return res.status(200).json({
    pillar: pillar.id,
    title: pillar.title,
    nav: pillar.nav,
    user: { name: session.name },
  })
}
