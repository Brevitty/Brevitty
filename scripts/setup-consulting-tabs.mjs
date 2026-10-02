// Idempotent setup for the consulting workspace in the Startup Junction spreadsheet
// (GOOGLE_SHEET_ID, same service account):
//   1. creates Consultees, Admins, ConsultingSessions, Tasks, Deliverables; appends any
//      header column the code now expects (e.g. mom_link, note) without moving data
//   2. seeds the original demo consultee/admin rows ONLY into a tab that has no data yet
//      (so it never resurrects rows you deleted later)
//   3. adds the permanent demo account all@example.com as a consultee (NEVER an admin: admins
//      take precedence at sign-in, and all@ must see the student flow) with sessions, tasks and
//      deliverables that exercise every state (missing MoM, overdue task, no-tasks, cancelled,
//      rescheduled), plus caughtup@example.com, a second student with nothing missing
//
//   node scripts/setup-consulting-tabs.mjs               # set up + add anything missing
//   node scripts/setup-consulting-tabs.mjs --reset-demo  # also put all@example.com's rows back
//                                                        # to seed state (after tests)
// Env (.env.local): GOOGLE_*, DEMO_ACCOUNT_PASSWORD (all@), DEMO_EMAIL + DEMO_ADMIN_EMAIL
//   (first-time demo rows; optional DEMO_PASSWORD / DEMO_ADMIN_PASSWORD, else random ones are printed once)
import crypto from 'node:crypto'
import { ensureTabs, upsertRows, countDemoRows, tabIds, requireEnv, wantsReset, istDay, DEMO_ACCOUNT_EMAIL, CAUGHT_UP_EMAIL, isSeedAccount } from './lib/sheetSetup.mjs'
import { sheetsRequest } from '../api/_lib/sheetsClient.js'
import { TABS, KEY_COL } from '../src/data/consultingConstants.js'

requireEnv(['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID', 'DEMO_ACCOUNT_PASSWORD', 'DEMO_EMAIL', 'DEMO_ADMIN_EMAIL'])

const PASSWORD_LEN = 10
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
// The original demo consultee's upcoming sessions are pinned: the first must be on/after 5 Oct 2026.
const UPCOMING_FIRST = '2026-10-05'
const UPCOMING_SECOND = '2026-10-09'

const randomPassword = () =>
  Array.from({ length: PASSWORD_LEN }, () => PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)]).join('')

/* ---------------- original demo rows (only into empty tabs) ---------------- */

function firstRunSeed() {
  const email = process.env.DEMO_EMAIL.trim().toLowerCase()
  const created = new Date().toISOString()
  const session = (session_id, date, start_time, end_time, topic, status, mom = '') => ({
    session_id, email, date, start_time, end_time, topic, status, mom, created_at: created,
  })
  return {
    Consultees: [
      { email, password: process.env.DEMO_PASSWORD?.trim() || randomPassword(), name: 'Ananya Sharma', department: 'Computer Science', course: 'B.Tech', sem: '6', phone: '9876543210', startup_name: 'GreenLoop', created_date: istDay(-30) },
      // No sessions: exercises the "no session in 14 days" list on the admin Today view.
      { email: 'rohan.verma@example.com', password: randomPassword(), name: 'Rohan Verma', department: 'Management Studies', course: 'BBA', sem: '4', phone: '9123456780', startup_name: 'CampusCart', created_date: istDay(-21) },
    ],
    Admins: [{ email: process.env.DEMO_ADMIN_EMAIL.trim().toLowerCase(), password: process.env.DEMO_ADMIN_PASSWORD?.trim() || randomPassword(), name: 'Consulting Admin' }],
    ConsultingSessions: [
      session('ses_demo0001', istDay(-14), '11:00', '12:00', 'Problem validation and customer interviews', 'completed',
        'Reviewed the GreenLoop problem statement. Target users are hostel residents who throw away reusable packaging.\n\nDecisions:\n- Validate with 10 interviews before building anything.\n- Drop the B2B angle for now.\n\nNext: interview log and a one-page problem statement.'),
      session('ses_demo0002', istDay(-7), '15:00', '15:45', 'Pricing and first-pilot plan', 'completed',
        'Interview themes: convenience beats price; 6 of 10 would pay a small monthly fee.\n\nDecisions:\n- Test three price tiers.\n- Run the first pilot in two hostel blocks.\n\nNext: pricing sheet and a pilot shortlist.'),
      session('ses_demo0003', UPCOMING_FIRST, '10:30', '11:30', 'Pitch deck review', 'scheduled'),
      session('ses_demo0004', UPCOMING_SECOND, '16:00', '16:30', 'Pilot check-in', 'scheduled'),
    ],
    Tasks: [
      { task_id: 'tsk_demo0001', session_id: 'ses_demo0001', email, task: 'Interview 10 target customers and log the insights', due_date: istDay(-8), status: 'done', completed_date: istDay(-9) },
      { task_id: 'tsk_demo0002', session_id: 'ses_demo0001', email, task: 'Draft a one-page problem statement', due_date: istDay(-3), status: 'open' }, // overdue on purpose
      { task_id: 'tsk_demo0003', session_id: 'ses_demo0002', email, task: 'Build a pricing sheet with three tiers', due_date: istDay(3), status: 'open' },
      { task_id: 'tsk_demo0004', session_id: 'ses_demo0002', email, task: 'Shortlist three pilot customers', due_date: istDay(1), status: 'open' },
    ],
    Deliverables: [
      { deliverable_id: 'dlv_demo0001', session_id: 'ses_demo0001', email, title: 'Customer interview log', link: 'https://example.com/greenloop/interview-log', status: 'reviewed', submitted_date: istDay(-9) },
      { deliverable_id: 'dlv_demo0002', session_id: 'ses_demo0002', email, title: 'Pricing sheet v1', status: 'pending' },
    ],
  }
}

/* ---------------- all@example.com + caughtup@example.com (always present) ---------------- */

// One row per state the UI has to show. Dates are relative to today (IST) so "past" and "upcoming" stay
// true whenever the script runs; times avoid overlaps (one consultant, one calendar).
//   ses_all00001 done, all clear          ses_all00002 finished, NO minutes, pending deliverable, overdue task
//   ses_all00003 finished, open task, pending deliverable   ses_all00004 upcoming, prep task
//   ses_all00005 upcoming, RESCHEDULED by sir (not yet seen)   ses_all00006 finished, "no tasks" + "no deliverables"
//   ses_all00007 CANCELLED                 ses_all00008 finished, sir hasn't added tasks/deliverables (waiting on sir)
function demoAccountSeed() {
  const created = new Date().toISOString()
  const session = (email, session_id, date, start_time, end_time, topic, status, extra = {}) => ({
    session_id, email, date, start_time, end_time, topic, status, mom: '', calendar_event_id: '', meet_link: '', created_at: created,
    mom_link: '', mom_submitted_at: '', no_tasks: '', no_deliverables: '', archived: '', rescheduled_from: '', reschedule_seen: '', ...extra,
  })
  const withMom = (mom) => ({ mom, mom_submitted_at: created })
  const task = (email, task_id, session_id, text, due_date, status, completed_date = '') => ({ task_id, session_id, email, task: text, due_date, status, completed_date, note: '' })
  const deliverable = (email, deliverable_id, session_id, title, status, link = '', submitted_date = '', note = '') => ({ deliverable_id, session_id, email, title, link, status, submitted_date, note })
  const a = DEMO_ACCOUNT_EMAIL
  const c = CAUGHT_UP_EMAIL
  return {
    Consultees: [
      { email: a, password: process.env.DEMO_ACCOUNT_PASSWORD.trim(), name: 'Demo Account', department: 'Computer Science', course: 'B.Tech', sem: '6', phone: '9000000000', startup_name: 'Re-Loop', created_date: istDay(-40) },
      { email: c, password: process.env.DEMO_ACCOUNT_PASSWORD.trim(), name: 'Caught Up', department: 'Design', course: 'B.Des', sem: '4', phone: '9000000001', startup_name: 'TidyDesk', created_date: istDay(-30) },
    ],
    ConsultingSessions: [
      session(a, 'ses_all00001', istDay(-21), '13:00', '14:00', 'Idea validation review', 'completed', withMom('Walked through the Re-Loop problem: students resell through scattered WhatsApp groups with no trust.\n\nDecisions:\n- Interview 10 hostel residents before building.\n- Keep payments offline for now.\n\nNext: interview log and a one-page problem statement.')),
      session(a, 'ses_all00002', istDay(-7), '13:00', '13:45', 'Pricing and pilot plan', 'completed'),
      session(a, 'ses_all00003', istDay(-2), '12:00', '12:30', 'Landing page feedback', 'completed', withMom('Landing page converts at 8% from WhatsApp traffic. Hero copy is too long.\n\nNext: add a waitlist form and share analytics.')),
      session(a, 'ses_all00004', istDay(3), '13:00', '14:00', 'Pitch rehearsal', 'scheduled'),
      session(a, 'ses_all00005', istDay(10), '15:00', '15:30', 'Investor intro prep', 'scheduled', { rescheduled_from: `${istDay(8)}|12:00|12:30` }),
      session(a, 'ses_all00006', istDay(-4), '16:00', '16:30', 'Quick check-in', 'completed', { ...withMom('Short check-in: on track, nothing new to assign.'), no_tasks: 'TRUE', no_deliverables: 'TRUE' }),
      session(a, 'ses_all00007', istDay(-5), '11:00', '11:30', 'Competitor deep-dive', 'cancelled'),
      session(a, 'ses_all00008', istDay(-1), '10:00', '10:30', 'Fundraising basics', 'completed', withMom('Covered SAFE notes and what to prepare before talking to angels.')),
      session(c, 'ses_cup00001', istDay(-6), '14:30', '15:15', 'Brand and positioning', 'completed', withMom('Settled on the TidyDesk positioning: the calm desk for hostel rooms.\n\nNext: ship the mood board.')),
      session(c, 'ses_cup00002', istDay(6), '14:30', '15:00', 'Launch checklist', 'scheduled'),
    ],
    Tasks: [
      task(a, 'tsk_all00001', 'ses_all00001', 'Interview 10 hostel residents and log quotes', istDay(-15), 'done', istDay(-16)),
      task(a, 'tsk_all00002', 'ses_all00001', 'Write a one-page problem statement', istDay(-12), 'done', istDay(-13)),
      task(a, 'tsk_all00003', 'ses_all00002', 'Build a pricing sheet with three tiers', istDay(2), 'open'),
      task(a, 'tsk_all00004', 'ses_all00002', 'Shortlist two hostel blocks for the pilot', istDay(-1), 'open'), // overdue on purpose
      task(a, 'tsk_all00005', 'ses_all00003', 'Add a waitlist form to the landing page', istDay(4), 'open'),
      task(a, 'tsk_all00006', 'ses_all00004', 'Rehearse the 3-minute pitch twice', istDay(3), 'open'), // prep task on an upcoming session
      task(c, 'tsk_cup00001', 'ses_cup00001', 'Ship the mood board', istDay(-2), 'done', istDay(-3)),
      task(c, 'tsk_cup00002', 'ses_cup00002', 'Draft the launch checklist', istDay(5), 'open'), // open but not overdue: nothing needs attention
    ],
    Deliverables: [
      deliverable(a, 'dlv_all00001', 'ses_all00001', 'Customer interview log', 'reviewed', 'https://example.com/reloop/interview-log', istDay(-16)),
      deliverable(a, 'dlv_all00002', 'ses_all00002', 'Pricing sheet v1', 'pending'),
      deliverable(a, 'dlv_all00003', 'ses_all00003', 'Landing page analytics screenshot', 'pending'),
      deliverable(a, 'dlv_all00004', 'ses_all00003', 'Updated problem statement', 'submitted', 'https://example.com/reloop/problem-statement', istDay(-1), 'Tightened after the landing page test.'),
      deliverable(c, 'dlv_cup00001', 'ses_cup00001', 'Mood board', 'submitted', 'https://example.com/tidydesk/mood-board', istDay(-3)),
    ],
  }
}

async function main() {
  const reset = wantsReset()
  const headers = await ensureTabs(TABS)
  const { title, ids } = await tabIds()
  console.log(`Spreadsheet: "${title}"${reset ? ' (resetting all@example.com to seed state)' : ''}`)

  // 1) original demo rows, only into tabs that are still empty
  const first = firstRunSeed()
  for (const [tab, rows] of Object.entries(first)) {
    const values = (await sheetsRequest(`/values/${encodeURIComponent(`'${tab}'!A:A`)}`)).values || []
    if (values.slice(1).some((r) => String(r[0] ?? '').trim())) continue
    await upsertRows(tab, headers[tab], rows, [KEY_COL[tab]], { sheetTabId: ids[tab] })
    if (tab === 'Admins' || tab === 'Consultees') for (const r of rows) console.log(`  ${tab} login: ${r.email}  /  ${r.password}`)
  }

  // 2) all@example.com, always
  const isDemo = isSeedAccount // rows either test account gained during a test run are removed on reset
  const seed = demoAccountSeed()
  for (const [tab, rows] of Object.entries(seed)) {
    await upsertRows(tab, headers[tab], rows, [KEY_COL[tab]], { reset, pruneWhere: isDemo, sheetTabId: ids[tab] })
  }

  const counts = await countDemoRows(Object.keys(seed))
  const admins = await countDemoRows(['Admins'])
  const bad = Object.entries(counts).filter(([tab, n]) => n !== seed[tab].filter((r) => r.email === DEMO_ACCOUNT_EMAIL).length)
  console.log(`\n${DEMO_ACCOUNT_EMAIL} rows: ${Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(', ')}, Admins=${admins.Admins}`)
  if (bad.length || admins.Admins) {
    console.error(`MISMATCH vs seed in: ${[...bad.map(([t]) => t), ...(admins.Admins ? ['Admins (must be 0)'] : [])].join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('Verified: every consulting tab matches the seed.')
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
