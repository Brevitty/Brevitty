// /api/hub/* — ONE serverless function for every signed-in Hub workspace route (Vercel Hobby
// caps a deployment at 12 functions; see the vercel.json rewrite and the dev-bridge prefix
// fallback in vite.config.js). Every route needs a valid sj_session; `pillar` routes also need
// an approved membership in that workspace, and every read/write is scoped to the session's
// own email (a student can never name another student's rows).
//   GET  workspace?pillar=<id>    the server-side role check the Hub workspace pages call
//   GET  dashboard | documents   POST documents   (Startup Junction)
//   GET  launchpad                POST launchpad/{setup,checklist,profile,documents,sessions}
//   Incubation responses are {ok:true,data} / {ok:false,error}; the client unwraps them (hubApi.js, useJunctionFetch).
//   GET  incubation               POST incubation/{profile,kpis,documents,funding,funding/delete,schemes/status}
//   File uploads/downloads for every workspace: /api/files (api/files.js).
//   GET  vac                      POST vac/{enroll,assignments,feedback}
//   POST competitions             (Startup Junction competitions: status / saved / proof link)
//   GET  admin/{overview,at-risk,workload,reports,users}   POST admin/users[/update]   (Hub Admin only, 403 otherwise)
//   GET  admin/launchpad[/student?email=]   POST admin/launchpad/{feedback,schedule,verify,signoff}   (Launchpad students review)
//   GET  admin/content?tab=   POST admin/content[/delete]   (competitions, schemes, templates, sessions)
import { readJson } from './_lib/http.js'
import { requireSession } from './_lib/session.js'
import { currentIdentity } from './_lib/signIn.js'
import { ApiError } from './_lib/consulting/rules.js'
import { getPillar } from '../src/data/hubPillars.js'
import { getDashboard } from './_lib/dashboardSheet.js'
import { getDocuments, saveDocument } from './_lib/documentsSheet.js'
import * as lp from './_lib/launchpadSheet.js'
import * as inc from './_lib/incubationSheet.js'
import * as vac from './_lib/vacSheet.js'
import { saveCompetition, warmStartup } from './_lib/dashboardSheet.js'
import * as admin from './_lib/hubAdmin.js'
import * as content from './_lib/contentAdmin.js'

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
  'GET dashboard': { pillar: 'startup', fn: (s) => getDashboard(s.email) },
  'POST competitions': { pillar: 'startup', fn: (s, r) => saveCompetition(s.email, r.body) },
  'GET documents': { pillar: 'startup', fn: async (s) => ({ documents: await getDocuments(s.email) }) },
  'POST documents': { pillar: 'startup', fn: (s, r) => saveDocument(s.email, r.body) },

  'GET launchpad': { pillar: 'launchpad', fn: (s) => lp.getLaunchpad(s.email) },
  'POST launchpad/setup': { pillar: 'launchpad', fn: (s, r) => lp.setupStudent(s.email, r.body) },
  'POST launchpad/checklist': { pillar: 'launchpad', fn: (s, r) => lp.setChecklistItem(s.email, r.body) },
  'POST launchpad/profile': { pillar: 'launchpad', fn: (s, r) => lp.saveProfileField(s.email, r.body) },
  'POST launchpad/documents': { pillar: 'launchpad', fn: (s, r) => lp.submitDocument(s.email, r.body) },
  'POST launchpad/sessions': { pillar: 'launchpad', fn: (s, r) => lp.updateMySession(s.email, r.body) },

  'GET incubation': { pillar: 'incubation', fn: (s) => inc.getIncubation(s.email) },
  'POST incubation/profile': { pillar: 'incubation', fn: (s, r) => inc.updateProfile(s.email, r.body) },
  'POST incubation/kpis': { pillar: 'incubation', fn: (s, r) => inc.updateKpis(s.email, r.body) },
  'POST incubation/documents': { pillar: 'incubation', fn: (s, r) => inc.saveDocument(s.email, r.body) },
  'POST incubation/funding': { pillar: 'incubation', fn: (s, r) => inc.saveFunding(s.email, r.body) },
  'POST incubation/funding/delete': { pillar: 'incubation', fn: (s, r) => inc.deleteFunding(s.email, r.body) },
  'POST incubation/schemes/status': { pillar: 'incubation', fn: (s, r) => inc.setSchemeStatus(s.email, r.body) },

  'GET vac': { pillar: 'vac', fn: (s) => vac.getVac(s.email) },
  'POST vac/enroll': { pillar: 'vac', fn: (s, r) => vac.enroll(s.email, r.body) },
  'POST vac/assignments': { pillar: 'vac', fn: (s, r) => vac.submitAssignment(s.email, r.body) },
  'POST vac/feedback': { pillar: 'vac', fn: (s, r) => vac.submitFeedback(s.email, r.body) },

  // Hub Admin: `admin: true` = the server checks the approved "admin" membership (only an email in
  // the Admins tab ever gets it, see signIn.js). Everything is computed from the real tabs.
  'GET admin/overview': { admin: true, fn: async () => (await admin.getModel()).overview },
  'GET admin/at-risk': { admin: true, fn: async () => { const m = await admin.getModel(); return { today: m.today, flags: m.flags } } },
  'GET admin/workload': { admin: true, fn: async () => { const m = await admin.getModel(); return { today: m.today, rows: m.workload } } },
  'GET admin/reports': { admin: true, fn: async () => { const m = await admin.getModel(); return { today: m.today, reports: m.reports } } },
  'GET admin/users': { admin: true, fn: async () => ({ users: (await admin.getModel()).users, pillars: admin.USER_PILLAR_CHOICES }) },
  'POST admin/users': { admin: true, fn: (s, r) => admin.createUser(r.body) },
  'POST admin/users/update': { admin: true, fn: (s, r) => admin.updateUser(r.body) },
  'GET admin/launchpad': { admin: true, fn: () => lp.launchpadStudents() },
  'GET admin/launchpad/student': { admin: true, fn: (s, r) => lp.launchpadStudentDetail({ email: r.query.get('email') }) },
  'POST admin/launchpad/feedback': { admin: true, fn: (s, r) => lp.staffFeedback(r.body) },
  'POST admin/launchpad/schedule': { admin: true, fn: (s, r) => lp.staffSchedule(r.body) },
  'POST admin/launchpad/verify': { admin: true, fn: (s, r) => lp.staffVerifyDocument(r.body) },
  'POST admin/launchpad/signoff': { admin: true, fn: (s, r) => lp.staffSignOff(s.name, r.body) },
  'GET admin/content': { admin: true, fn: (s, r) => content.listContent(r.query.get('tab') || 'Competitions') },
  'POST admin/content': { admin: true, fn: (s, r) => content.saveContent(r.body) },
  'POST admin/content/delete': { admin: true, fn: (s, r) => content.deleteContent(r.body) },

}

// Vercel rewrites to /api/hub?p=<route>; the dev bridge leaves /hub/<route>. Accept both.
function routeOf(url) {
  const p = url.searchParams.get('p') ?? url.pathname.replace(/^\/(api\/)?hub\/?/, '')
  return p.replace(/^\/+|\/+$/g, '')
}

async function identityOr401(req, res) {
  const identity = await currentIdentity(req)
  if (!identity) res.status(401).json({ ok: false, error: 'Not signed in.' })
  return identity
}

// 401 signed out, 403 signed in without the admin membership (the Admins tab is the only source of it).
async function adminOr403(req, res) {
  const identity = await identityOr401(req, res)
  if (identity && !hasPillar(identity, 'admin')) {
    res.status(403).json({ ok: false, error: 'You do not have access to this.' })
    return null
  }
  return identity
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const url = new URL(req.url || '', 'http://localhost')
  const route = routeOf(url)
  const entry = Object.hasOwn(ROUTES, `${req.method} ${route}`) ? ROUTES[`${req.method} ${route}`] : null
  if (!entry) {
    const allowed = Object.keys(ROUTES).filter((k) => k.endsWith(` ${route}`)).map((k) => k.split(' ')[0])
    if (!allowed.length) return res.status(404).json({ ok: false, error: 'Not found.' })
    res.setHeader('Allow', allowed.join(', '))
    return res.status(405).json({ ok: false, error: 'Method not allowed.' })
  }

  // The role check reads the same identity /api/me shows (Startup Junction + consulting + admin);
  // every data route needs the Startup Junction session itself.
  const session = entry.admin ? await adminOr403(req, res) : entry.identity ? await identityOr401(req, res) : await requireSession(req, res)
  if (!session) return

  try {
    if (entry.pillar && !hasPillar(session, entry.pillar)) throw new ApiError(403, 'You do not have access to this workspace.')
    if (entry.pillar === 'startup' && req.method === 'GET') await warmStartup()
    const body = req.method === 'POST' ? readJson(req) : {}
    if (!body) throw new ApiError(400, 'Request body must be a JSON object.')
    const data = await entry.fn(session, { query: url.searchParams, body })
    return res.status(200).json({ ok: true, data })
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.status).json({ ok: false, error: err.message })
    console.error(`[hub:${route}] ${err.message}`)
    return res.status(503).json({ ok: false, error: UNAVAILABLE })
  }
}
