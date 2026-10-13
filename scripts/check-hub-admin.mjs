// Hub Admin checks.
//   1. Pure: buildModel() on a tiny in-memory db (no network): at-risk rules, MoU renewal window, workload, reports.
//   2. Live (needs `npx vite --port 5199`): admin routes are 401 signed out and 403 for the demo account; admin
//      responses never contain the demo account; nobody opens another user's file; a created user can sign in
//      (that row is removed again). No check depends on specific seed rows.
//   node scripts/check-hub-admin.mjs            (CHECK_BASE_URL overrides http://localhost:5199)
import assert from 'node:assert/strict'
import './lib/sheetSetup.mjs' // loads .env.local
import { sheetsRequest } from '../api/_lib/sheetsClient.js'
import { buildModel, realOnly, MOU_RENEWAL_WARN_DAYS } from '../api/_lib/hubAdmin.js'
import { DEMO_EMAILS } from '../api/_lib/accounts.js'
import { addDays } from '../api/_lib/consulting/rules.js'
import { addYears } from '../src/data/incubationRules.js'
import { tabIds } from './lib/sheetSetup.mjs'

const NOW = Date.parse('2026-10-12T06:30:00Z') // 12:00 IST, a Monday
const TODAY = '2026-10-12'
const empty = () => ({
  students: [], consultees: [], admins: [], sessions: [], tasks: [], deliverables: [], cohortSessions: [], mentors: [], mentorAssignments: [],
  checklist: [], attendance: [], invoices: [], profiles: [], competitionEntries: [], lpStudents: [], lpChecklist: [], lpProfile: [], lpDocuments: [],
  lpSessions: [], lpMentors: [], lpSignoff: [], incStartups: [], incDocuments: [], incKpis: [], incFunding: [], vacLearners: [], vacSessions: [],
  vacAttendance: [], vacAssignments: [],
})
const kinds = (m, email) => m.flags.filter((f) => f.email === email).map((f) => f.kind).sort()

/* ---------------- 1. pure rules ---------------- */
{
  const db = empty()
  db.students.push({ email: 'a@example.com', name: 'A', memberships: 'startup:approved' }, { email: 'b@example.com', name: 'B', memberships: 'startup:pending' })
  // A attended 1 of 3 held cohort sessions -> low attendance. B is pending, so never flagged.
  db.cohortSessions = ['s1', 's2', 's3'].map((id, i) => ({ session_id: id, date: addDays(TODAY, -(i + 2)), mentor: 'M', summary: 'x' }))
  db.attendance = [{ email: 'a@example.com', session_id: 's1', status: 'present' }, { email: 'b@example.com', session_id: 's1', status: 'absent' }]

  // Incubation: renewal exactly on the 60-day edge is flagged, 61 is not; no MoU is flagged separately.
  const mou = (email, daysLeft) => ({ email, kind: 'mou', file_path: 'https://x.test/mou', uploaded_at: addYears(addDays(TODAY, daysLeft), -3) })
  db.incStartups = ['edge60', 'edge61', 'overdue', 'nomou'].map((n) => ({ email: `${n}@example.com`, startup: n }))
  db.incDocuments = [mou('edge60@example.com', MOU_RENEWAL_WARN_DAYS), mou('edge61@example.com', MOU_RENEWAL_WARN_DAYS + 1), mou('overdue@example.com', -5)]

  // Consulting: a finished session with no MoM, tasks or deliverables, plus 3 overdue open tasks.
  db.consultees = [{ email: 'c@example.com', name: 'C', startup_name: 'CS' }]
  db.sessions = [{ session_id: 'x1', email: 'c@example.com', date: addDays(TODAY, -8), start_time: '10:00', end_time: '10:30', status: 'completed', mom: '', no_tasks: '', no_deliverables: '', archived: '' }]
  db.tasks = [1, 2, 3].map((i) => ({ task_id: `t${i}`, session_id: 'x1', email: 'c@example.com', task: 't', due_date: addDays(TODAY, -i), status: 'open' }))

  // VAC: 1 of 4 held classes attended + one overdue assignment.
  db.vacLearners = [{ email: 'v@example.com', name: 'V', course: 'E', batch: 'B', faculty: 'F' }]
  db.vacSessions = [1, 2, 3, 4].map((i) => ({ session_id: `v${i}`, date: addDays(TODAY, -i), course: 'E', batch: 'B' }))
  db.vacAttendance = [{ email: 'v@example.com', session_id: 'v1', status: 'present' }]
  db.vacAssignments = [{ assignment_id: 'a1', email: 'v@example.com', title: 'T', due: addDays(TODAY, -2), status: 'pending' }]

  const m = buildModel(db, NOW)
  assert.deepEqual(kinds(m, 'a@example.com'), ['low_attendance'])
  assert.deepEqual(kinds(m, 'b@example.com'), [])
  assert.ok(kinds(m, 'edge60@example.com').includes('mou_renewal'), 'renewal at 60 days is flagged')
  assert.ok(!kinds(m, 'edge61@example.com').includes('mou_renewal'), 'renewal at 61 days is not')
  assert.ok(kinds(m, 'overdue@example.com').includes('mou_renewal'))
  assert.ok(kinds(m, 'nomou@example.com').includes('mou_missing'))
  assert.deepEqual(kinds(m, 'c@example.com').filter((k) => k !== 'inactive'), ['missing_updates', 'overdue_tasks'])
  assert.equal(m.flags.find((f) => f.email === 'c@example.com' && f.kind === 'overdue_tasks').severity, 'high') // 3 overdue
  assert.deepEqual(kinds(m, 'v@example.com'), ['low_attendance', 'overdue_assignments'])
  assert.equal(m.flags.find((f) => f.email === 'v@example.com' && f.kind === 'low_attendance').severity, 'high') // 25% < 50%
  assert.equal(m.flags[0].severity, 'high') // sorted most severe first
  assert.equal(m.overview.totals.users, m.users.length)
  assert.equal(m.overview.totals.pendingApprovals, 1) // B's pending startup membership
  assert.equal(m.reports.length, 6)
  assert.equal(m.workload.find((w) => w.team === 'Consulting').pending, 2) // missing MoM + missing tasks/deliverables are counted per kind
  console.log('PASS  buildModel at-risk rules, MoU window, overview, reports')
}

/* ---------------- 1b. the demo account never reaches the admin model ---------------- */
{
  const DEMO = DEMO_EMAILS[0]
  const db = empty()
  db.students.push({ email: DEMO, name: 'Demo', memberships: 'startup:approved,vac:approved' }, { email: 'real@uni.edu', name: 'Real', memberships: 'vac:approved' })
  db.consultees = [{ email: DEMO, name: 'Demo', startup_name: 'D' }]
  db.vacLearners = [{ email: DEMO, name: 'Demo', course: 'E', batch: 'DEMO' }, { email: 'real@uni.edu', name: 'Real', course: 'E', batch: 'B' }]
  db.vacSessions = [{ session_id: 'd1', course: 'E', batch: 'DEMO', date: TODAY }, { session_id: 'r1', course: 'E', batch: 'B', date: TODAY }]
  db.lpMentors = [{ mentor_id: 'x', name: 'Demo', contact_email: DEMO }]
  db.cohortSessions = [{ session_id: 'cs_demo_01', date: TODAY, topic: 'Demo' }, { session_id: 'real1', date: TODAY, topic: 'Real' }]
  const m = buildModel(realOnly(db), NOW)
  assert.ok(!JSON.stringify(m).includes(DEMO) && !JSON.stringify(m).includes('cs_demo_'), 'demo account leaked into the admin model')
  assert.equal(m.overview.upcomingThisWeek.vac, 1, "only real learners' classes count")
  assert.equal(m.overview.totals.users, 1)
  console.log('PASS  admin model excludes the demo account')
}

/* ---------------- 2. live API ---------------- */
const BASE = process.env.CHECK_BASE_URL || 'http://localhost:5199'
const PACE_MS = 700
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const reachable = await fetch(`${BASE}/api/me`).then(() => true, () => false)
if (!reachable) {
  console.log(`SKIP  live checks (no server at ${BASE}). Start it with: npx vite --port 5199`)
  process.exit(0)
}

function browser() {
  const jar = new Map()
  return async function call(method, path, body) {
    await sleep(PACE_MS)
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: 'manual',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body ? JSON.stringify(body) : undefined,
    })
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';')
      const k = pair.slice(0, pair.indexOf('=')).trim()
      const v = pair.slice(pair.indexOf('=') + 1).trim()
      if (!v || attrs.some((a) => a.trim().toLowerCase() === 'max-age=0')) jar.delete(k)
      else jar.set(k, v)
    }
    const text = await res.text()
    let json = {}
    try {
      json = JSON.parse(text)
    } catch {
      /* the file viewer answers HTML on purpose */
    }
    return { status: res.status, json, text, location: res.headers.get('location') }
  }
}

const rows = async (tab) => (await sheetsRequest(`/values/${encodeURIComponent(`'${tab}'`)}!A:Z`)).values || []
const passwordOf = async (tab, email) => {
  const [hdr, ...body] = await rows(tab)
  const i = hdr.map((h) => h.toLowerCase()).indexOf('email')
  const p = hdr.map((h) => h.toLowerCase()).indexOf('password')
  return body.find((r) => String(r[i]).trim().toLowerCase() === email)?.[p]
}
const ADMIN = String((await rows('Admins'))[1]?.[0] || '').trim().toLowerCase()
const DEMO = DEMO_EMAILS[0]
const creds = { demo: await passwordOf('Students', DEMO), admin: await passwordOf('Admins', ADMIN) }
const signIn = async (email, password) => {
  const b = browser()
  const r = await b('POST', '/api/login', { email, password })
  assert.equal(r.status, 200, `sign-in as ${email}`)
  return b
}

const HUB_ADMIN_GETS = ['overview', 'at-risk', 'workload', 'reports', 'users', 'launchpad', 'attendance', 'content?tab=Competitions'].map((r) => ['GET', `/api/hub/admin/${r}`])
const CONSULTING_ADMIN_GETS = ['summary', 'consultees', 'sessions', 'board'].map((r) => ['GET', `/api/consulting/admin/${r}`])
const ADMIN_POSTS = [
  ['POST', '/api/hub/admin/users', { email: 'x@example.com', name: 'X' }],
  ['POST', '/api/hub/admin/users/update', { email: 'x@example.com', name: 'X' }],
  ['POST', '/api/hub/admin/content', { tab: 'Competitions', row: { name: 'X' } }],
  ['POST', '/api/hub/admin/content/delete', { tab: 'Competitions', key: 'x' }],
]
let passed = 0
const check = async (name, fn) => {
  try {
    await fn()
    passed++
    console.log(`PASS  ${name}`)
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${err.message.split('\n').slice(0, 4).join(' ')}`)
    process.exitCode = 1
  }
}

const out = browser()
await check('signed out: every admin route is 401', async () => {
  for (const [m, p, b] of [...HUB_ADMIN_GETS, ...CONSULTING_ADMIN_GETS, ...ADMIN_POSTS]) assert.equal((await out(m, p, b)).status, 401, p)
})

const demo = await signIn(DEMO, creds.demo)
await check('demo account is not an admin: every admin route is 403', async () => {
  for (const [m, p, b] of [...HUB_ADMIN_GETS, ...CONSULTING_ADMIN_GETS, ...ADMIN_POSTS]) assert.equal((await demo(m, p, b)).status, 403, p)
  assert.equal((await demo('GET', '/api/hub/workspace?pillar=admin')).status, 403)
  assert.equal((await demo('GET', '/api/hub/launchpad/mentor')).status, 403) // not a Launchpad mentor either
})
await check("a user cannot open another user's file, or upload outside their workspaces", async () => {
  for (const path of ['startup/someone@uni.edu/x/1-a.pdf', 'consulting/someone@uni.edu/x/1-a.pdf', `vac/${DEMO}/../someone/1-a.pdf`]) {
    const r = await demo('GET', `/api/files/view?path=${encodeURIComponent(path)}`)
    assert.equal(r.status, 403, path)
    assert.ok(!r.location, 'no redirect to storage')
  }
  assert.equal((await out('GET', `/api/files/view?path=${encodeURIComponent(`vac/${DEMO}/x/1-a.pdf`)}`)).status, 401)
  assert.equal((await demo('POST', '/api/files/upload-url', { pillar: 'admin', doc_id: 'x', filename: 'a.pdf', size: 1 })).status, 403)
  assert.equal((await demo('POST', '/api/files/upload-url', { pillar: 'vac', doc_id: 'x', filename: 'a.exe', size: 1 })).status, 400)
  const ok = await demo('POST', '/api/files/upload-url', { pillar: 'vac', doc_id: 'x', filename: 'a.pdf', size: 10, type: 'application/pdf' })
  assert.equal(ok.status, 200)
  assert.ok(ok.json.data.path.startsWith(`vac/${DEMO}/x/`), "the path is always the caller's own folder")
  // A save endpoint refuses a path that is not the caller's own.
  assert.equal((await demo('POST', '/api/hub/documents', { doc_id: 'coi', file_path: 'startup/someone@uni.edu/coi/1-a.pdf' })).status, 400)
})
await check('a user only ever reads their own rows', async () => {
  const mine = await demo('GET', '/api/hub/dashboard')
  assert.equal(mine.status, 200)
  const emails = mine.text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []
  assert.ok(emails.every((e) => e.toLowerCase() === DEMO), `dashboard mentions another account: ${emails.find((e) => e.toLowerCase() !== DEMO)}`)
})

const admin = await signIn(ADMIN, creds.admin)
await check('admin: every admin page answers, and none mentions the demo account', async () => {
  for (const [m, p] of [...HUB_ADMIN_GETS, ...CONSULTING_ADMIN_GETS]) {
    const r = await admin(m, p)
    assert.equal(r.status, 200, p)
    assert.ok(!r.text.toLowerCase().includes(DEMO), `${p} mentions ${DEMO}`)
  }
  for (const tab of ['INC_SchemeList', 'Mentors', 'LP_Mentors', 'ItemResources', 'CohortSessions', 'VAC_Sessions']) {
    const r = await admin('GET', `/api/hub/admin/content?tab=${tab}`)
    assert.equal(r.status, 200, tab)
    assert.ok(!r.text.toLowerCase().includes(DEMO) && !r.text.includes('"DEMO"'), `content ${tab} shows demo rows`)
  }
  assert.equal((await admin('GET', `/api/consulting/admin/consultee?email=${encodeURIComponent(DEMO)}`)).status, 404)
  assert.ok(!(await admin('GET', '/api/hub/admin/users')).text.toLowerCase().includes('"password"'), 'passwords never leave the server')
})
await check('admin: validation errors are friendly', async () => {
  assert.equal((await admin('GET', '/api/hub/workspace?pillar=admin')).status, 200)
  assert.equal((await admin('POST', '/api/hub/admin/users', { email: 'nope', name: 'X' })).status, 400)
  assert.equal((await admin('POST', '/api/hub/admin/users', { email: 'zz@example.com', name: 'Z', memberships: { admin: 'approved' } })).status, 400)
  assert.equal((await admin('POST', '/api/hub/admin/users', { email: DEMO, name: 'Dup', memberships: { vac: 'approved' } })).status, 409)
  assert.equal((await admin('POST', '/api/hub/admin/users/update', { email: DEMO, name: 'Nope' })).status, 404) // the demo account isn't managed here
  assert.equal((await admin('POST', '/api/hub/admin/users/update', { email: 'ghost@example.com', name: 'Nope' })).status, 404)
  assert.equal((await admin('POST', '/api/hub/admin/content', { tab: 'Competitions', row: { name: 'X' } })).status, 400) // link + deadline required
})

const TEST_EMAIL = `check.run.${Date.now()}@example.com`
await check('admin: create a user, change their access, they can sign in; then clean up', async () => {
  const created = await admin('POST', '/api/hub/admin/users', { email: TEST_EMAIL, name: 'Check Run', memberships: { vac: 'pending' } })
  assert.equal(created.status, 200)
  const pw = created.json.data.password
  assert.ok(pw && pw.length >= 6)
  assert.equal((await admin('POST', '/api/hub/admin/users/update', { email: TEST_EMAIL, memberships: { vac: 'approved' } })).status, 200)
  const user = await signIn(TEST_EMAIL, pw)
  assert.equal((await user('GET', '/api/hub/workspace?pillar=vac')).status, 200)
  assert.equal((await user('GET', '/api/hub/workspace?pillar=startup')).status, 403)
  assert.equal((await user('GET', '/api/hub/admin/overview')).status, 403)
  const vac = await user('GET', '/api/hub/vac')
  assert.equal(vac.status, 200)
  assert.equal(vac.json.data.learner, null) // a brand-new learner gets the enrolment screen
})
{
  // Remove only the row this run created.
  const { ids } = await tabIds()
  const all = await rows('Students')
  const at = all.findIndex((r) => String(r[0]).toLowerCase() === TEST_EMAIL)
  if (at > 0) {
    await sheetsRequest(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: ids.Students, dimension: 'ROWS', startIndex: at, endIndex: at + 1 } } }] }) })
    console.log('cleanup: removed the check-run Students row')
  }
}
console.log(`\n${passed} live checks passed${process.exitCode ? ', with failures above' : ''}.`)
