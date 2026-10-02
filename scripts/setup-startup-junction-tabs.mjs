// Idempotent setup for Startup Junction in the sheet the roster reads (GOOGLE_SHEET_ID,
// same service account):
//   1. creates the tracking tabs (ChecklistStatus, Attendance, Documents, SessionProgress,
//      Mentors, MentorAssignments) and the dashboard tabs (StartupProfiles, Invoices,
//      MentorSessions, Activity); a missing header column is appended, nothing is moved
//   2. makes sure the Students tab has a "memberships" column (blank = legacy startup:approved,
//      so existing students are unaffected)
//   3. seeds the cohort rows every student sees (Mentors, MentorSessions) and the permanent
//      demo account all@example.com in every tab, with DEMO_ACCOUNT_PASSWORD as its password
//
// Safe to re-run: seed rows are matched by key and only added when missing. Existing students'
// rows are never touched.
//   node scripts/setup-startup-junction-tabs.mjs               # set up + add anything missing
//   node scripts/setup-startup-junction-tabs.mjs --reset-demo  # also put all@example.com's rows
//                                                              # back to seed state (after tests)
import { ensureTabs, upsertRows, countDemoRows, tabIds, requireEnv, wantsReset, istDay, DEMO_ACCOUNT_EMAIL, demoMemberships } from './lib/sheetSetup.mjs'
import { DASHBOARD_TABS } from '../api/_lib/dashboardSheet.js'
import { PILLARS } from '../src/data/hubPillars.js'

requireEnv(['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID', 'DEMO_ACCOUNT_PASSWORD'])

const STUDENTS_TAB = process.env.GOOGLE_SHEET_TAB?.trim() || 'Students'
const TABS = {
  [STUDENTS_TAB]: ['email', 'password', 'name', 'memberships'],
  ChecklistStatus: ['email', 'item_id', 'checked', 'checked_date'],
  Attendance: ['email', 'session_id', 'date', 'status'],
  Documents: ['email', 'doc_id', 'status', 'submitted_date'],
  SessionProgress: ['email', 'session_id', 'completed', 'quiz_score', 'completed_date'],
  Mentors: ['mentor_id', 'name', 'expertise', 'bio', 'contact_email'],
  MentorAssignments: ['email', 'mentor_id', 'assigned_date'],
  ...DASHBOARD_TABS,
}

const email = DEMO_ACCOUNT_EMAIL
const mine = (rows) => rows.map((r) => ({ email, ...r }))

// Cohort-wide rows (every student sees these). Dates are fixed: they are the cohort calendar.
const COHORT = {
  Mentors: [
    { mentor_id: 'm-priya', name: 'Priya Nair', expertise: 'Product & MVP scoping', bio: 'Ex-product lead at a campus-commerce startup; helps teams cut an MVP down to what proves demand.', contact_email: 'priya.nair@example.com' },
    { mentor_id: 'm-rohan', name: 'Rohan Mehta', expertise: 'Go-to-market & sales', bio: 'Built two student-focused marketplaces; runs the GTM and first-customer sessions.', contact_email: 'rohan.mehta@example.com' },
    { mentor_id: 'm-anita', name: 'Anita Rao', expertise: 'Finance & fundraising', bio: 'Angel investor and CA; reviews unit economics and investment readiness.', contact_email: 'anita.rao@example.com' },
  ],
  MentorSessions: [
    { session_id: 'session-1', date: '2026-09-01', time: '5:00 PM – 5:45 PM IST', platform: 'Google Meet', mentor: 'Rohan Mehta', topic: 'Idea validation check-in', summary: 'Idea holds up: confirmed the WhatsApp-group workaround and willingness to pay ₹50/listing.', action_item: 'Get 3 people to actually pay before the next session.' },
    { session_id: 'session-2', date: '2026-09-15', time: '5:00 PM – 5:45 PM IST', platform: 'Google Meet', mentor: 'Rohan Mehta', topic: 'GTM channel walkthrough', summary: 'Narrowed the ICP to hostel residents and mapped two channels: campus WhatsApp groups and hostel wardens.', action_item: 'Interview 5 more students outside your own hostel by Friday.' },
    { session_id: 'session-3', date: '2026-09-29', time: '4:00 PM – 5:00 PM IST', platform: 'Google Meet', mentor: 'Priya Nair', topic: 'MVP scope review', summary: 'Cut the MVP to listing + chat; payments stay offline for the pilot.', action_item: 'Ship the listing flow to 10 testers.' },
    { session_id: 'session-4', date: '2026-10-13', time: '4:00 PM – 5:00 PM IST', platform: 'Google Meet', mentor: 'Anita Rao', topic: 'Unit economics and pricing', summary: '', action_item: '' },
  ],
}

// all@example.com: enough in every tab that each dashboard screen shows real data.
function demoSeed() {
  return {
    [STUDENTS_TAB]: [{
      email,
      password: process.env.DEMO_ACCOUNT_PASSWORD.trim(),
      name: 'Demo Account',
      // Every USER workspace. Never an adminOnly one: Hub Admin comes only from the Admins tab.
      memberships: demoMemberships(PILLARS),
    }],
    ChecklistStatus: mine(
      ['founder-profile', 'problem-areas', 'team-agreement', 'pitch-deck-draft', 'startup-description', 'problem-statement',
        'solution-concept', 'competitor-scan', 'interview-log', 'fit-summary', 'product-summary'].map((item_id) => ({
        item_id, checked: 'TRUE', checked_date: istDay(-10),
      }))
    ),
    Attendance: mine([
      { session_id: 'session-1', date: '2026-09-01', status: 'present' },
      { session_id: 'session-2', date: '2026-09-15', status: 'present' },
      { session_id: 'session-3', date: '2026-09-29', status: 'absent' },
    ]),
    Documents: mine([
      { doc_id: 'bank-account-proof', status: 'verified', submitted_date: istDay(-20) },
      { doc_id: 'incubation-mou', status: 'verified', submitted_date: istDay(-18) },
      { doc_id: 'founders-kyc', status: 'submitted', submitted_date: istDay(-3) },
      { doc_id: 'coi', status: 'submitted', submitted_date: istDay(-2) },
    ]),
    SessionProgress: mine([
      { session_id: 'session-1', completed: 'TRUE', quiz_score: 80, completed_date: '2026-09-02' },
      { session_id: 'session-2', completed: 'TRUE', quiz_score: 90, completed_date: '2026-09-16' },
    ]),
    MentorAssignments: mine([
      { mentor_id: 'm-priya', assigned_date: '2026-08-20' },
      { mentor_id: 'm-rohan', assigned_date: '2026-08-20' },
    ]),
    StartupProfiles: mine([{
      startup_name: 'Re-Loop',
      team_name: 'Re-Loop',
      one_liner: 'A campus marketplace for reselling textbooks and hostel gear.',
      description: 'Re-Loop lets students list and buy used textbooks, cycles, and hostel gear within their own campus, cutting out random WhatsApp groups and DMs.',
      problem: 'Students lose money and time reselling their stuff through scattered WhatsApp groups with no trust or discovery.',
      solution: 'A verified, campus-only marketplace with in-app chat and a simple listing flow.',
      product: 'A mobile-first web app where students list items in under a minute and browse by category and hostel block.',
      interviews_run: 12,
    }]),
    Invoices: mine([
      { date: '2026-08-18', customer: 'Priya (Hostel B)', amount: 1200, note: 'Sold: DS textbook set' },
      { date: '2026-08-27', customer: 'Rahul K', amount: 2800, note: 'Sold: bicycle' },
      { date: '2026-09-03', customer: 'Sneha M', amount: 1450, note: 'Sold: study table + rack' },
      { date: '2026-09-12', customer: 'Campus Store Co-op', amount: 2800, note: 'Bulk resale, 6 textbook sets' },
    ]),
    Activity: mine([
      { date: istDay(-1), kind: 'document', title: 'Pitch deck requested', actor: 'Program team' },
      { date: istDay(-2), kind: 'complete', title: 'Validation stage completed', actor: 'You' },
      { date: istDay(-4), kind: 'session', title: 'Session scheduled: Unit economics and pricing', actor: 'with Anita Rao' },
      { date: istDay(-6), kind: 'feedback', title: 'Mentor feedback received', actor: 'Rohan Mehta' },
    ]),
  }
}

const KEYS = {
  [STUDENTS_TAB]: ['email'],
  ChecklistStatus: ['email', 'item_id'],
  Attendance: ['email', 'session_id'],
  Documents: ['email', 'doc_id'],
  SessionProgress: ['email', 'session_id'],
  Mentors: ['mentor_id'],
  MentorAssignments: ['email', 'mentor_id'],
  StartupProfiles: ['email'],
  Invoices: ['email', 'date', 'customer'],
  MentorSessions: ['session_id'],
  Activity: ['email', 'title'],
}

async function main() {
  const reset = wantsReset()
  const headers = await ensureTabs(TABS)
  const { title, ids } = await tabIds()
  console.log(`Spreadsheet: "${title}"${reset ? ' (resetting all@example.com to seed state)' : ''}`)

  const isDemo = (row) => String(row.email || '').toLowerCase() === email
  const seed = { ...COHORT, ...demoSeed() }
  for (const [tab, rows] of Object.entries(seed)) {
    await upsertRows(tab, headers[tab], rows, KEYS[tab], {
      reset,
      // Only the demo account's own extra rows are ever removed; cohort tabs are never pruned.
      pruneWhere: tab in COHORT ? null : isDemo,
      sheetTabId: ids[tab],
    })
  }

  const counts = await countDemoRows(Object.keys(demoSeed()))
  const expected = demoSeed()
  const bad = Object.entries(counts).filter(([tab, n]) => n !== expected[tab].length)
  console.log(`\n${email} rows: ${Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(', ')}`)
  if (bad.length) {
    console.error(`MISMATCH vs seed in: ${bad.map(([t]) => t).join(', ')} (run with ${'--reset-demo'} to restore)`)
    process.exitCode = 1
  } else {
    console.log('Verified: every tab matches the seed. Existing students were not touched.')
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
