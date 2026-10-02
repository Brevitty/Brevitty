// Idempotent setup for the Launchpad Abroad, Incubation, VAC Learner and Partner Services workspaces in the same
// sheet the roster reads (GOOGLE_SHEET_ID, same service account):
//   1. creates the LP_*, INC_*, VAC_* and PS_* tabs (a missing header column is appended, nothing moved)
//   2. gives all@example.com every user workspace (incl. the three new ones) in the Students tab,
//      and adds the Launchpad demo mentor account (password = DEMO_ACCOUNT_PASSWORD)
//   3. seeds demo data: all@example.com in every pillar (Launchpad: mid-journey in Phase 2 Validate),
//      plus a few Launchpad classmates so the mentor list and Community tab aren't empty
//
// Safe to re-run: seed rows are matched by key and only added when missing.
//   node scripts/setup-hub-pillars-tabs.mjs               # set up + add anything missing
//   node scripts/setup-hub-pillars-tabs.mjs --reset-demo  # also put the seed accounts' rows back
//                                                          # to seed state (after scripts/check-hub-api.mjs)
import { ensureTabs, upsertRows, tabIds, requireEnv, wantsReset, istDay, DEMO_ACCOUNT_EMAIL, demoMemberships } from './lib/sheetSetup.mjs'
import { PILLARS } from '../src/data/hubPillars.js'
import { PHASES } from '../src/data/launchpadChecklist.js'
import { LP_TABS } from '../api/_lib/launchpadSheet.js'
import { INC_TABS } from '../api/_lib/incubationSheet.js'
import { VAC_TABS } from '../api/_lib/vacSheet.js'
import { PS_TABS } from '../api/_lib/partnerSheet.js'

requireEnv(['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID', 'DEMO_ACCOUNT_PASSWORD'])

const LP_MENTOR_EMAIL = 'lp.mentor@example.com'
const PACE_MS = 1100
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STUDENTS_TAB = process.env.GOOGLE_SHEET_TAB?.trim() || 'Students'
const ALL = DEMO_ACCOUNT_EMAIL
const CLASSMATES = { ananya: 'ananya.k@example.com', kabir: 'kabir.m@example.com', riya: 'riya.d@example.com' }
const SEED_EMAILS = new Set([ALL, ...Object.values(CLASSMATES)])
const DEMO_LINK = (path) => `https://example.com/demo/${path}`

const itemsOf = (phaseId, { optional = false } = {}) =>
  PHASES.find((p) => p.id === phaseId).items.filter((it) => optional || it.required).map((it) => it.id)
const ticks = (email, ids, daysAgo) => ids.map((item_id) => ({ email, item_id, checked: 'TRUE', checked_date: istDay(-daysAgo) }))
const profile = (email, rows) => rows.map(([section, field, value]) => ({ email, section, field, value }))

/* ---------------- Launchpad Abroad ---------------- */
const LAUNCHPAD = {
  LP_Mentors: [
    { mentor_id: 'lpm-kavya', name: 'Kavya Iyer', expertise: 'University admissions & profile strategy', bio: 'Former admissions reader for a US liberal-arts college; helps students turn what they built into a story admissions officers remember.', contact_email: LP_MENTOR_EMAIL },
    // all@ is also a (demo) mentor so one login can open the mentor view; it never sees or reviews its own record.
    { mentor_id: 'lpm-demo', name: 'Demo Account', expertise: 'Demo mentor account', bio: 'The all-workspaces demo login, set up as a mentor so the mentor view can be shown with one account.', contact_email: ALL },
    { mentor_id: 'lpm-arjun', name: 'Arjun Bhatia', expertise: 'Product building for young founders', bio: 'Built and sold an ed-tech app at 22; coaches school founders from first prototype to first 100 users.', contact_email: 'arjun.bhatia@example.com' },
  ],
  LP_Students: [
    { email: ALL, name: 'Demo Account', grade: '11', school: 'Delhi Public School, R.K. Puram', guardian_name: 'Meera Sharma', guardian_contact: '+91 98100 12345', guardian_consent: 'TRUE', mentor_id: 'lpm-kavya' },
    { email: CLASSMATES.ananya, name: 'Ananya Krishnan', grade: '12', school: "Bishop Cotton Girls' School, Bengaluru", guardian_name: 'R. Krishnan', guardian_contact: '+91 98450 22110', guardian_consent: 'TRUE', mentor_id: 'lpm-kavya' },
    { email: CLASSMATES.riya, name: 'Riya Desai', grade: '12', school: 'Cathedral & John Connon School, Mumbai', guardian_name: 'Nikhil Desai', guardian_contact: '+91 98200 44781', guardian_consent: 'TRUE', mentor_id: 'lpm-arjun' },
    { email: CLASSMATES.kabir, name: 'Kabir Malhotra', grade: '10', school: 'Modern School, Barakhamba Road', guardian_name: 'Sonia Malhotra', guardian_contact: '+91 99100 67230', guardian_consent: 'TRUE', mentor_id: 'lpm-arjun' },
  ],
  LP_Checklist: [
    // all@: Ideate done (incl. optionals), half of Validate's compulsory items -> current phase is Validate
    ...ticks(ALL, itemsOf('ideate', { optional: true }), 30),
    ...ticks(ALL, ['lp-interviews', 'lp-quotes'], 6),
    // Ananya: all four phases done -> waiting for a mentor's Profile Ready sign-off
    ...ticks(CLASSMATES.ananya, ['ideate', 'validate', 'build', 'impact'].flatMap((p) => itemsOf(p, { optional: true })), 12),
    ...ticks(CLASSMATES.riya, [...itemsOf('ideate'), ...itemsOf('validate'), 'lp-scope'], 9),
    ...ticks(CLASSMATES.kabir, ['lp-problems'], 3),
  ],
  LP_Profile: [
    ...profile(ALL, [
      ['about', 'interests', 'Environmental science, debating, robotics'],
      ['about', 'intended_major', 'Environmental Engineering'],
      ['startup', 'name', 'GreenCart'],
      ['startup', 'one_liner', 'Pre-ordered school canteen meals, so kitchens cook what students actually eat.'],
      ['startup', 'problem', 'Our school canteen throws away 30–40 kg of cooked food a day because it guesses demand.'],
      ['startup', 'solution', 'Students pre-order lunch by 10 AM on a simple web form; the kitchen cooks to the order count.'],
      ['activities', 'activities', 'Eco Club president, DPS R.K. Puram (2024–now)\nDebate team, state finalist (2025)\nRobotics club member (2023–now)'],
      ['activities', 'achievements', 'Ran a 4-week food-waste audit across 3 canteens\nInterviewed 12 students and 3 canteen staff'],
      ['proof', 'deck_link', DEMO_LINK('greencart-deck')],
    ]),
    ...profile(CLASSMATES.ananya, [
      ['startup', 'name', 'ReadAloud'],
      ['startup', 'one_liner', 'Peer reading buddies for Grade 2–4 kids in government schools.'],
      ['about', 'interests', 'Education policy, Carnatic music'],
      ['about', 'intended_major', 'Public Policy'],
      ['activities', 'activities', 'Founder, ReadAloud (2024–now)'],
      ['activities', 'achievements', '140 children reached across 4 schools'],
      ['awards', 'awards', 'Global Youth Changemaker shortlist (2026)'],
      ['proof', 'demo_link', DEMO_LINK('readaloud-demo')],
      ['proof', 'deck_link', DEMO_LINK('readaloud-deck')],
      ['proof', 'testimonials', '"Reading hour is the kids\' favourite now." — Ms. Latha, headmistress'],
    ]),
    ...profile(CLASSMATES.riya, [
      ['startup', 'name', 'ThriftLoop'],
      ['startup', 'one_liner', 'A school-uniform swap that keeps outgrown uniforms in use.'],
      ['about', 'interests', 'Sustainable fashion, economics'],
    ]),
    ...profile(CLASSMATES.kabir, [['startup', 'name', 'StudyStack'], ['startup', 'one_liner', 'Shared notes for Grade 10 board prep, ranked by classmates.']]),
  ],
  LP_Documents: [
    { email: ALL, doc_id: 'resume', status: 'submitted', submitted_date: istDay(-4), link: DEMO_LINK('resume') },
    { email: ALL, doc_id: 'pitch-deck', status: 'verified', submitted_date: istDay(-15), link: DEMO_LINK('greencart-deck') },
    { email: ALL, doc_id: 'recommendation-1', status: 'submitted', submitted_date: istDay(-2), link: DEMO_LINK('rec-letter-1') },
    { email: CLASSMATES.ananya, doc_id: 'resume', status: 'verified', submitted_date: istDay(-20), link: DEMO_LINK('ananya-resume') },
    { email: CLASSMATES.ananya, doc_id: 'startup-demo', status: 'submitted', submitted_date: istDay(-3), link: DEMO_LINK('readaloud-demo') },
  ],
  LP_Sessions: [
    { session_id: 'lps_all0001', email: ALL, mentor_id: 'lpm-kavya', date: istDay(-21), time: '17:00', status: 'completed', mom: 'Picked GreenCart over the two other ideas: strongest personal story and easiest to test inside school.', deliverables: 'One-line problem statement; list of 10 people to interview', tasks: 'Book interviews with canteen staff' },
    { session_id: 'lps_all0002', email: ALL, mentor_id: 'lpm-kavya', date: istDay(-7), time: '17:00', status: 'completed', mom: '', deliverables: '', tasks: '' },
    { session_id: 'lps_all0003', email: ALL, mentor_id: 'lpm-kavya', date: istDay(5), time: '17:30', status: 'scheduled', mom: '', deliverables: '', tasks: '' },
    { session_id: 'lps_ana0001', email: CLASSMATES.ananya, mentor_id: 'lpm-kavya', date: istDay(-10), time: '18:00', status: 'completed', mom: 'Impact story draft reviewed; ready for sign-off once documents are in.', deliverables: 'Impact story v2', tasks: 'Upload demo video' },
  ],
  LP_Signoff: [],
  LP_Feedback: [
    { email: ALL, mentor_id: 'lpm-kavya', date: istDay(-6), feedback: 'Great interview quotes. Before the survey, tighten your question 3: it leads the answer.' },
  ],
}

/* ---------------- Incubation (values from the Incubation module of the website framework) ---------------- */
const INCUBATION = {
  INC_Startups: [{
    email: ALL, startup: 'Re-Loop Technologies Pvt Ltd', stage: 'Scaling', runway_months: '11.4', revenue: '1860000',
    capital_facilitated: '7200000', compliance_pct: '92', jobs_created: '14', mou_renewal: '2027-01-15',
    exit_status: 'Active', exit_review: 'Not due', transition_plan: 'To be reviewed at next quarterly review',
  }],
  INC_Compliance: [
    { email: ALL, item: 'MoU', status: 'Active', review_date: '2027-01-15', note: 'Renewal' },
    { email: ALL, item: 'Signed MoU', status: 'Submitted', review_date: '', note: 'Read-only' },
    { email: ALL, item: 'DPIIT recognition', status: 'Verified', review_date: '', note: 'Certificate on file' },
    { email: ALL, item: 'Quarterly compliance checklist', status: '92% complete', review_date: istDay(18), note: 'Next review' },
    { email: ALL, item: 'IP documentation', status: 'In progress', review_date: istDay(30), note: 'Trademark filing sequence' },
  ],
  INC_KPIs: [
    ['revenue', '1520000', 'Q2 2026', 'New'], ['revenue', '1860000', 'Q3 2026', 'Growing'],
    ['runway', '11.4', 'Q2 2026', 'New'], ['runway', '11.4', 'Q3 2026', 'Stable'],
    ['jobs', '11', 'Q2 2026', 'New'], ['jobs', '14', 'Q3 2026', 'Growing'],
    ['compliance', '88', 'Q2 2026', 'New'], ['compliance', '92', 'Q3 2026', 'Growing'],
  ].map(([metric, value, period, trend]) => ({ email: ALL, metric, value, period, trend })),
  INC_Funding: [
    { email: ALL, source: 'North Star Ventures', stage: 'Intro', amount: '5000000', status: 'Meeting' },
    { email: ALL, source: 'Seed Network', stage: 'Term sheet', amount: '7500000', status: 'Active' },
    { email: ALL, source: 'Grant opportunity', stage: 'Application', amount: '1500000', status: 'In preparation' },
  ],
  INC_Documents: [
    { email: ALL, doc: 'Incorporation certificate', type: 'Legal', status: 'Submitted', link: DEMO_LINK('incorporation-certificate') },
    { email: ALL, doc: 'Cap table snapshot', type: 'Governance', status: 'Submitted', link: DEMO_LINK('cap-table') },
    { email: ALL, doc: 'Signed MoU', type: 'Agreement', status: 'Read-only', link: DEMO_LINK('signed-mou') },
    { email: ALL, doc: 'Funding history', type: 'Finance', status: 'Updated', link: DEMO_LINK('funding-history') },
  ],
  INC_Schemes: [
    { email: ALL, scheme: 'DPIIT recognition', relevance: 'Startup recognition', status: 'Verified' },
    { email: ALL, scheme: 'State startup support', relevance: 'Funding / support', status: 'Eligible' },
    { email: ALL, scheme: 'Innovation grant', relevance: 'Product development', status: 'Exploring' },
  ],
  INC_Media: [
    { email: ALL, asset: 'Founder story draft', type: 'Article', status: 'Review' },
    { email: ALL, asset: 'Startup profile', type: 'Web profile', status: 'Published' },
    { email: ALL, asset: 'Demo Day announcement', type: 'Social / PR', status: 'Scheduled' },
  ],
  INC_Resources: [
    { resource: 'Fundraising Readiness Checklist', format: 'PDF', use: 'Investor preparation', link: '' },
    { resource: 'Quarterly KPI Template', format: 'XLSX', use: 'Reporting', link: '' },
    { resource: 'IP Protection Guide', format: 'PDF', use: 'IP planning', link: '' },
  ],
}

/* ---------------- VAC Learner (values from the VAC module of the website framework) ---------------- */
const VAC_SESSION_PLAN = [
  [-33, 'Startup fundamentals'], [-30, 'Customer discovery'], [-26, 'Problem–solution fit'], [-23, 'Business model canvas'],
  [-19, 'Value proposition design'], [-16, 'Market sizing'], [-12, 'Market validation'], [-9, 'Pricing & revenue models'],
  [-5, 'Pitch storytelling'], [-2, 'Funding basics'], [2, 'Legal & compliance basics'], [5, 'Demo day prep'],
]
const VAC_ABSENT = 'vac_ent_06'
const vacId = (i) => `vac_ent_${String(i + 1).padStart(2, '0')}`
const VAC = {
  VAC_Learners: [{ email: ALL, name: 'Demo Account', roll_no: 'BV23ENT042', program: 'B.Tech Computer Science', semester: '5', course: 'Entrepreneurship', batch: 'B-02', faculty: 'Dr. Neha Rao' }],
  VAC_Sessions: VAC_SESSION_PLAN.map(([d, title], i) => ({ session_id: vacId(i), date: istDay(d), time: '16:00', title, course: 'Entrepreneurship', batch: 'B-02' })),
  VAC_Attendance: VAC_SESSION_PLAN.filter(([d]) => d < 0).map((_, i) => ({ email: ALL, session_id: vacId(i), status: vacId(i) === VAC_ABSENT ? 'absent' : 'present' })),
  VAC_Content: [
    { course: 'Entrepreneurship', title: 'Entrepreneurship fundamentals', format: 'PPT', status: 'Available', link: '' },
    { course: 'Entrepreneurship', title: 'Business model canvas', format: 'Worksheet', status: 'Available', link: '' },
    { course: 'Entrepreneurship', title: 'Market validation framework', format: 'PDF', status: 'Available', link: '' },
    { course: 'Entrepreneurship', title: 'Pitch deck template', format: 'PPT', status: 'Releases before Demo day prep', link: '' },
  ],
  VAC_Assignments: [
    ['Startup idea brief', -31, 'reviewed'], ['Customer interview notes', -27, 'reviewed'], ['Problem statement', -24, 'reviewed'],
    ['Business model canvas', -20, 'reviewed'], ['Value proposition canvas', -17, 'reviewed'], ['Market sizing sheet', -13, 'submitted'],
    ['Customer validation worksheet', -10, 'submitted'], ['Pricing experiment', -6, 'submitted'], ['Pitch outline', 4, 'in progress'],
  ].map(([title, d, status], i) => ({
    assignment_id: `vas_all${String(i + 1).padStart(4, '0')}`, email: ALL, title, due: istDay(d), status,
    link: status === 'in progress' ? '' : DEMO_LINK(`vac-assignment-${i + 1}`),
  })),
  VAC_Feedback: [],
}

/* ---------------- Partner Services (values from the partner module of the website framework) ---------------- */
const PARTNER = {
  PS_Partners: [{
    email: ALL, org_name: 'PIIC', university: 'PIIC partner university (demo)', org_type: 'Academic institution',
    contact_name: 'Dr. Meera Kapoor', contact_email: 'meera.kapoor@example.com', contact_phone: '+91 98290 41120',
    representatives: 'Dr. Meera Kapoor (Institutional coordinator); Amit Verma (Program liaison)',
    financial_commitment: '₹48L for FY26: startup support, student innovation grants, program operations',
    mou_ref: 'PIIC-2026-04', linked_startups: '12',
  }],
  PS_Programs: [
    ['Startup Junction', 'Cohort', 'Active', '12 startups'], ['VAC', 'Value-added course', 'Active', '311 learners'],
    ['Mentorship', 'Support program', 'Active', '19 participants'], ['Innovation challenge', 'Event', 'Planned', '—'],
  ].map(([program, type, status, participants]) => ({ email: ALL, program, type, status, participants })),
  PS_Disbursements: [
    ['Startup support', '2400000'], ['Student innovation grants', '1200000'], ['Program operations', '1200000'],
  ].map(([program, amount]) => ({ email: ALL, program, amount, period: 'Q3 FY26', status: 'Disbursed' })),
  PS_Reports: [
    { email: ALL, report: 'Quarterly impact report', period: 'Q3 FY26', status: 'In preparation', due_date: '2026-09-30', link: '' },
    { email: ALL, report: 'Utilization report', period: 'Q3 FY26', status: 'Submitted', due_date: '', link: DEMO_LINK('piic-utilization-q3') },
    { email: ALL, report: 'Program outcomes', period: 'H1 FY26', status: 'Submitted', due_date: '', link: DEMO_LINK('piic-outcomes-h1') },
  ],
  PS_Events: [
    { email: ALL, date: '2026-09-18', event: 'Innovation showcase', participants: 'Partner + founders', status: 'Upcoming' },
    { email: ALL, date: '2026-09-25', event: 'Founder networking session', participants: 'Institutions + startups', status: 'Planned' },
    { email: ALL, date: '2026-10-04', event: 'Demo Day', participants: 'Ecosystem partners', status: 'Planned' },
  ],
  PS_Contacts: [
    { email: ALL, contact: 'Dr. Meera Kapoor', role: 'Institutional coordinator', contact_email: 'meera.kapoor@example.com', status: 'Active' },
    { email: ALL, contact: 'Amit Verma', role: 'Program liaison', contact_email: 'amit.verma@example.com', status: 'Active' },
  ],
  PS_Renewals: [
    { email: ALL, partnership: 'Primary MoU', renewal_date: '2027-01-15', status: 'Review planned' },
    { email: ALL, partnership: 'Program addendum', renewal_date: '2027-03-30', status: 'Active' },
    { email: ALL, partnership: 'Event partnership', renewal_date: '2026-10-04', status: 'Planned' },
  ],
  PS_MoU: [
    { email: ALL, document: 'MoU', reference: 'PIIC-2026-04', status: 'Active' },
    { email: ALL, document: 'Signed agreement', reference: 'PIIC-2026-04', status: 'Read-only' },
    { email: ALL, document: 'Financial schedule', reference: 'FS-2026-Q3', status: 'Submitted' },
  ],
}

const KEYS = {
  LP_Students: ['email'], LP_Checklist: ['email', 'item_id'], LP_Profile: ['email', 'section', 'field'], LP_Documents: ['email', 'doc_id'],
  LP_Sessions: ['session_id'], LP_Mentors: ['mentor_id'], LP_Signoff: ['email'], LP_Feedback: ['email', 'feedback'],
  INC_Startups: ['email'], INC_Compliance: ['email', 'item'], INC_KPIs: ['email', 'metric', 'period'], INC_Funding: ['email', 'source'],
  INC_Documents: ['email', 'doc'], INC_Schemes: ['email', 'scheme'], INC_Media: ['email', 'asset'], INC_Resources: ['resource'],
  VAC_Learners: ['email'], VAC_Sessions: ['session_id'], VAC_Attendance: ['email', 'session_id'], VAC_Content: ['course', 'title'],
  VAC_Assignments: ['assignment_id'], VAC_Feedback: ['email', 'area'],
  PS_Partners: ['email'], PS_Programs: ['email', 'program'], PS_Disbursements: ['email', 'program', 'period'], PS_Reports: ['email', 'report', 'period'],
  PS_Events: ['email', 'event'], PS_Contacts: ['email', 'contact'], PS_Renewals: ['email', 'partnership'], PS_MoU: ['email', 'document'],
}
const SHARED_TABS = new Set(['LP_Mentors', 'INC_Resources', 'VAC_Sessions', 'VAC_Content']) // no per-student rows; never pruned

async function main() {
  const reset = wantsReset()
  const schemas = { ...LP_TABS, ...INC_TABS, ...VAC_TABS, ...PS_TABS }
  const headers = await ensureTabs({ ...schemas, [STUDENTS_TAB]: ['email', 'password', 'name', 'memberships'] })
  const { title, ids } = await tabIds()
  console.log(`Spreadsheet: "${title}"${reset ? ' (resetting the seed accounts to seed state)' : ''}`)

  // all@: every USER workspace (never an adminOnly one). Only the memberships cell is rewritten.
  const memberships = demoMemberships(PILLARS)
  await upsertRows(STUDENTS_TAB, headers[STUDENTS_TAB], [{ email: ALL, memberships }], ['email'], { reset: true })
  // The Launchpad demo mentor signs in with /signin like everyone else; LP_Mentors grants the mentor view.
  await upsertRows(STUDENTS_TAB, headers[STUDENTS_TAB], [{ email: LP_MENTOR_EMAIL, password: process.env.DEMO_ACCOUNT_PASSWORD.trim(), name: 'Kavya Iyer', memberships: 'none' }], ['email'], { reset })

  const seed = { ...LAUNCHPAD, ...INCUBATION, ...VAC, ...PARTNER }
  for (const [tab, rows] of Object.entries(seed)) {
    await sleep(PACE_MS) // one read (+ maybe a write) per tab: stay under 60 reads/min
    await upsertRows(tab, headers[tab], rows, KEYS[tab], {
      reset,
      pruneWhere: SHARED_TABS.has(tab) ? null : (row) => SEED_EMAILS.has(String(row.email || '').toLowerCase()),
      sheetTabId: ids[tab],
    })
  }
  console.log('\nDone. Existing non-seed rows were not touched.')
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
