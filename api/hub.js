// /api/hub/* — ONE serverless function for every signed-in Hub workspace route (Vercel Hobby
// caps a deployment at 12 functions; see the vercel.json rewrite and the dev-bridge prefix
// fallback in vite.config.js). Every route needs a valid sj_session; `pillar` routes also need
// an approved membership in that workspace, and every read/write is scoped to the session's
// own email (a student can never name another student's rows).
//   GET  workspace?pillar=<id>    the server-side role check the Hub workspace pages call
//   GET  dashboard | mentors | mentor-assignments | documents | attendance   (Startup Junction)
//   GET  launchpad                POST launchpad/{checklist,profile,documents,sessions}
//   GET  launchpad/mentor[/student?email=]   POST launchpad/mentor/{feedback,schedule,verify,signoff}
//        (mentor routes: the signed-in email must be a contact_email in LP_Mentors)
//   GET  incubation               POST incubation/{kpis,documents}
//   GET  vac                      POST vac/{assignments,feedback}
//   GET  partner                  POST partner/{reports,contact}
import { readJson } from './_lib/http.js'
import { requireSession } from './_lib/session.js'
import { currentIdentity } from './_lib/signIn.js'
import { ApiError } from './_lib/consulting/rules.js'
import { getPillar } from '../src/data/hubPillars.js'
import { getDashboard } from './_lib/dashboardSheet.js'
import { getMentors } from './_lib/mentorsSheet.js'
import { getMentorAssignments } from './_lib/mentorAssignmentsSheet.js'
import { getDocuments } from './_lib/documentsSheet.js'
import { getAttendanceSummary } from './_lib/attendanceSheet.js'
import * as lp from './_lib/launchpadSheet.js'
import * as inc from './_lib/incubationSheet.js'
import * as vac from './_lib/vacSheet.js'
import * as ps from './_lib/partnerSheet.js'

const MAX_PILLAR_CHARS = 32
const UNAVAILABLE = 'This section is temporarily unavailable. Please try again in a few minutes.'

// Hiding routes in the UI is not access control; this is. Unknown pillars simply have
// no approved membership, so they get the same 403.
function workspace(session, { query }) {
  const raw = query.get('pillar') || ''
  const pillarId = raw.length <= MAX_PILLAR_CHARS ? raw : ''
  if (!hasPillar(session, pillarId)) throw new ApiError(403, 'You do not have access to this workspace.')
  const pillar = getPillar(pillarId)
  return { pillar: pillar.id, title: pillar.title, nav: pillar.nav, user: { name: session.name } }
}

const hasPillar = (session, id) => session.memberships.some((m) => m.pillar === id && m.status === 'approved')

// 'METHOD route': { fn(session, { query, body }), pillar? }
const ROUTES = {
  'GET workspace': { fn: workspace, identity: true },
  'GET dashboard': { fn: (s) => getDashboard(s.email) },
  'GET mentors': { fn: async () => ({ mentors: await getMentors() }) },
  'GET mentor-assignments': { fn: async (s) => ({ assignments: await getMentorAssignments(s.email) }) },
  'GET documents': { fn: async (s) => ({ documents: await getDocuments(s.email) }) },
  'GET attendance': { fn: (s) => getAttendanceSummary(s.email) },

  'GET launchpad': { pillar: 'launchpad', fn: (s) => lp.getLaunchpad(s.email) },
  'POST launchpad/checklist': { pillar: 'launchpad', fn: (s, r) => lp.setChecklistItem(s.email, r.body) },
  'POST launchpad/profile': { pillar: 'launchpad', fn: (s, r) => lp.saveProfileField(s.email, r.body) },
  'POST launchpad/documents': { pillar: 'launchpad', fn: (s, r) => lp.submitDocument(s.email, r.body) },
  'POST launchpad/sessions': { pillar: 'launchpad', fn: (s, r) => lp.updateMySession(s.email, r.body) },
  'GET launchpad/mentor': { fn: (s) => lp.mentorStudents(s.email) },
  'GET launchpad/mentor/student': { fn: (s, r) => lp.mentorStudentDetail(s.email, { email: r.query.get('email') }) },
  'POST launchpad/mentor/feedback': { fn: (s, r) => lp.mentorFeedback(s.email, r.body) },
  'POST launchpad/mentor/schedule': { fn: (s, r) => lp.mentorSchedule(s.email, r.body) },
  'POST launchpad/mentor/verify': { fn: (s, r) => lp.mentorVerifyDocument(s.email, r.body) },
  'POST launchpad/mentor/signoff': { fn: (s, r) => lp.mentorSignOff(s.email, r.body) },

  'GET incubation': { pillar: 'incubation', fn: (s) => inc.getIncubation(s.email) },
  'POST incubation/kpis': { pillar: 'incubation', fn: (s, r) => inc.updateKpis(s.email, r.body) },
  'POST incubation/documents': { pillar: 'incubation', fn: (s, r) => inc.addDocument(s.email, r.body) },

  'GET vac': { pillar: 'vac', fn: (s) => vac.getVac(s.email) },
  'POST vac/assignments': { pillar: 'vac', fn: (s, r) => vac.submitAssignment(s.email, r.body) },
  'POST vac/feedback': { pillar: 'vac', fn: (s, r) => vac.submitFeedback(s.email, r.body) },

  'GET partner': { pillar: 'partner', fn: (s) => ps.getPartner(s.email) },
  'POST partner/reports': { pillar: 'partner', fn: (s, r) => ps.submitReport(s.email, r.body) },
  'POST partner/contact': { pillar: 'partner', fn: (s, r) => ps.updateContact(s.email, r.body) },
}

// Vercel rewrites to /api/hub?p=<route>; the dev bridge leaves /hub/<route>. Accept both.
function routeOf(url) {
  const p = url.searchParams.get('p') ?? url.pathname.replace(/^\/(api\/)?hub\/?/, '')
  return p.replace(/^\/+|\/+$/g, '')
}

async function identityOr401(req, res) {
  const identity = await currentIdentity(req)
  if (!identity) res.status(401).json({ error: 'Not signed in.' })
  return identity
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const url = new URL(req.url || '', 'http://localhost')
  const route = routeOf(url)
  const entry = Object.hasOwn(ROUTES, `${req.method} ${route}`) ? ROUTES[`${req.method} ${route}`] : null
  if (!entry) {
    const allowed = Object.keys(ROUTES).filter((k) => k.endsWith(` ${route}`)).map((k) => k.split(' ')[0])
    if (!allowed.length) return res.status(404).json({ error: 'Not found.' })
    res.setHeader('Allow', allowed.join(', '))
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  // The role check reads the same identity /api/me shows (Startup Junction + consulting + admin);
  // every data route needs the Startup Junction session itself.
  const session = entry.identity ? await identityOr401(req, res) : await requireSession(req, res)
  if (!session) return

  try {
    if (entry.pillar && !hasPillar(session, entry.pillar)) throw new ApiError(403, 'You do not have access to this workspace.')
    const body = req.method === 'POST' ? readJson(req) : {}
    if (!body) throw new ApiError(400, 'Request body must be a JSON object.')
    return res.status(200).json(await entry.fn(session, { query: url.searchParams, body }))
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message })
    console.error(`[hub:${route}] ${err.message}`)
    return res.status(503).json({ error: UNAVAILABLE })
  }
}
