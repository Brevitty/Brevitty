// Resets the ONE demo account (DEMO_EMAILS in api/_lib/accounts.js, all@example.com) to a small,
// realistic data set in every workspace it has: Startup Junction, Consulting, Launchpad Abroad,
// Incubation and VAC Learner. It never touches any other account's rows, and admin views never
// show this account.
//
//   node scripts/setup-sheets.js     # first: creates missing tabs / columns
//   node scripts/setup-storage.mjs   # first: creates the private storage bucket
//   node scripts/seed-demo.js
//
// Each run: deletes the demo account's rows (except its Students / Consultees login rows, whose
// password is kept), removes its stored files, then writes the set below with dates relative to
// today (IST) and a few small PDFs so "View" works. Its VAC classes use their own batch (DEMO_VAC_BATCH),
// so no real learner ever sees them.
// Env: DEMO_ACCOUNT_PASSWORD, only used if the demo login row does not exist yet.
import { createClient } from '@supabase/supabase-js'
import { ensureTabs, requireEnv, istDay, tabIds } from './lib/sheetSetup.mjs'
import { sheetsRequest } from '../api/_lib/sheetsClient.js'
import { DEMO_EMAILS, DEMO_VAC_BATCH } from '../api/_lib/accounts.js'
import { ALL_SCHEMAS, STUDENTS_TAB } from './lib/schemas.js'
import { PILLARS } from '../src/data/hubPillars.js'
import { quarterOf } from '../src/data/incubationRules.js'

requireEnv(['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'])

const DEMO = DEMO_EMAILS[0]
const LOGIN_TABS = [STUDENTS_TAB, 'Consultees']
const FILE_PILLARS = ['startup', 'consulting', 'launchpad', 'incubation', 'vac']
const d = istDay
const q = (tab) => encodeURIComponent(`'${tab.replace(/'/g, "''")}'`)
const lc = (v) => String(v ?? '').trim().toLowerCase()
const bucket = process.env.SUPABASE_BUCKET?.trim() || 'hub-files'
const storage = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } }).storage.from(bucket)

/* ---------------- files: tiny one-page PDFs ---------------- */
function pdf(title) {
  const text = title.replace(/[()\\]/g, '')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const stream = `BT /F1 20 Tf 60 760 Td (${text}) Tj ET`
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  let out = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

let fileSeq = 0
const files = [] // { path, title } uploaded after the old ones are removed
// Same path layout as api/_lib/files.js: {pillar}/{email}/{doc_id}/{timestamp}-{name}
function file(pillar, docId, name, title) {
  const path = `${pillar}/${DEMO}/${docId}/${Date.now() + fileSeq++}-${name}`
  files.push({ path, title })
  return path
}

/* ---------------- the demo account's rows ---------------- */
const seed = {}
const put = (tab, ...rows) => (seed[tab] = [...(seed[tab] || []), ...rows.flat()])

// Startup Junction
put('StartupProfiles', {
  email: DEMO, startup_name: 'Re-Loop', team_name: 'Re-Loop', one_liner: 'A campus marketplace for reselling textbooks and hostel gear.',
  description: 'Re-Loop lets students list and buy used textbooks, cycles and hostel essentials in one verified, campus-only place instead of scattered WhatsApp groups.',
  problem: 'Students lose money and time reselling through WhatsApp groups with no trust, no discovery and no price reference.',
  solution: 'A verified, campus-only marketplace with in-app chat and a flat listing fee.',
  product: 'A mobile-first web app: list an item in under a minute, chat with buyers, hand over on campus.', interviews_run: '18',
})
const SJ_TICKS = ['founder-profile', 'problem-areas', 'team-agreement', 'pitch-deck-draft', 'startup-description', 'problem-statement', 'solution-concept', 'competitor-scan']
put('ChecklistStatus', SJ_TICKS.map((item_id, i) => ({ email: DEMO, item_id, checked: 'TRUE', checked_date: d(-40 + i * 4) })))
put('Invoices',
  { email: DEMO, date: d(-21), customer: 'Hostel B resale', amount: '1200', note: 'Textbook set' },
  { email: DEMO, date: d(-9), customer: 'Hostel C resale', amount: '2800', note: 'Bicycle' },
)
put('Activity',
  { email: DEMO, date: d(-2), kind: 'document', title: 'Founders’ KYC uploaded', actor: 'You' },
  { email: DEMO, date: d(-12), kind: 'complete', title: 'Ideation stage completed', actor: 'You' },
)
put('Documents',
  { email: DEMO, doc_id: 'bank-account-proof', status: 'verified', submitted_date: d(-20), file_url: file('startup', 'bank-account-proof', 'Bank-account-proof.pdf', 'Bank account proof') },
  { email: DEMO, doc_id: 'founders-kyc', status: 'submitted', submitted_date: d(-2), file_url: file('startup', 'founders-kyc', 'Founders-KYC.pdf', 'Founders KYC') },
)

// Consulting
const S = (id, off, start, end, topic, status, extra = {}) => ({
  session_id: id, email: DEMO, date: d(off), start_time: start, end_time: end, topic, status, mom: '', calendar_event_id: '', meet_link: '',
  created_at: `${d(Math.min(off - 3, -1))}T09:30:00.000Z`, mom_link: '', mom_submitted_at: '', no_tasks: '', no_deliverables: '', archived: '', rescheduled_from: '', reschedule_seen: '', ...extra,
})
put('ConsultingSessions',
  S('ses_demo0001', -14, '13:00', '14:00', 'Idea validation review', 'completed', {
    mom: 'Agreed the first test is 10 interviews across three hostel blocks before writing any code.', mom_submitted_at: `${d(-13)}T09:30:00.000Z`,
  }),
  S('ses_demo0002', -8, '12:00', '12:30', 'Quick check-in', 'completed', {
    mom: 'On track; nothing new to assign this week.', mom_submitted_at: `${d(-7)}T09:30:00.000Z`, no_tasks: 'TRUE', no_deliverables: 'TRUE',
  }),
  S('ses_demo0003', -4, '13:00', '13:45', 'Pricing and pilot plan', 'completed'), // the student still owes minutes
  S('ses_demo0004', 5, '13:00', '14:00', 'Pitch rehearsal', 'scheduled'),
)
put('Tasks',
  { task_id: 'tsk_demo0001', session_id: 'ses_demo0001', email: DEMO, task: 'Interview 10 hostel residents and log quotes', due_date: d(-7), status: 'done', completed_date: d(-8), note: '' },
  { task_id: 'tsk_demo0002', session_id: 'ses_demo0003', email: DEMO, task: 'Build a pricing sheet with three tiers', due_date: d(3), status: 'open', completed_date: '', note: '' },
)
put('Deliverables',
  { deliverable_id: 'dlv_demo0001', session_id: 'ses_demo0001', email: DEMO, title: 'Customer interview log', link: file('consulting', 'dlv_demo0001', 'Interview-log.pdf', 'Customer interview log'), status: 'reviewed', submitted_date: d(-9), note: '' },
  { deliverable_id: 'dlv_demo0002', session_id: 'ses_demo0003', email: DEMO, title: 'Pricing sheet v1', link: '', status: 'pending', submitted_date: '', note: '' },
)

// Launchpad Abroad
put('LP_Students', { email: DEMO, name: 'Aarav Sharma', grade: '12', school: 'Senior secondary school, Jaipur', guardian_name: 'Rakesh Sharma', guardian_contact: '', guardian_consent: 'TRUE' })
put('LP_Checklist', ['lp-problems', 'lp-problem-pick', 'lp-idea', 'lp-why-you', 'lp-inspiration', 'lp-interviews'].map((item_id, i) => ({ email: DEMO, item_id, checked: 'TRUE', checked_date: d(-30 + i * 4) })))
put('LP_Profile', [
  ['about', 'interests', 'Circular economy, debating, robotics'], ['about', 'intended_major', 'Environmental Engineering'],
  ['startup', 'name', 'Re-Loop'], ['startup', 'one_liner', 'A campus marketplace for reselling textbooks and hostel gear.'],
].map(([section, field, value]) => ({ email: DEMO, section, field, value })))
put('LP_Documents', { email: DEMO, doc_id: 'resume', status: 'submitted', submitted_date: d(-3), link: file('launchpad', 'resume', 'Resume.pdf', 'Resume') })
put('LP_Sessions',
  { session_id: 'lps_demo0001', email: DEMO, date: d(-10), time: '17:00', status: 'completed', mom: 'Picked Re-Loop: strongest personal story and easiest to test.', deliverables: 'One-line problem statement', tasks: 'List 10 people to interview' },
  { session_id: 'lps_demo0002', email: DEMO, date: d(6), time: '17:30', status: 'scheduled', mom: '', deliverables: '', tasks: '' },
)

// Incubation
const thisQuarter = quarterOf(d(0))
const lastQuarter = quarterOf(d(-92))
put('INC_Startups', { email: DEMO, startup: 'Re-Loop', founder_name: 'Aarav Sharma', sector: 'Campus e-commerce', stage: 'MVP', website: '', updated_at: d(-3) })
put('INC_Documents', { email: DEMO, id: 'mou', kind: 'mou', title: 'MoU', file_name: 'Incubation-MoU.pdf', file_path: file('incubation', 'mou', 'Incubation-MoU.pdf', 'Incubation MoU'), status: 'submitted', uploaded_at: d(-200), renewal_date: '' })
put('INC_KPIs',
  { email: DEMO, quarter: lastQuarter, revenue: '0', runway_months: '9', jobs_created: '1', updated_at: d(-95) },
  { email: DEMO, quarter: thisQuarter, revenue: '4000', runway_months: '8', jobs_created: '2', updated_at: d(-3) },
)
put('INC_Funding',
  { email: DEMO, id: 'fund_demo0001', funder: 'College incubator seed grant', type: 'Grant', amount: '150000', date: d(-120), status: 'Received', notes: 'For the first pilot.', file_name: '', file_path: '', created_at: d(-120) },
  { email: DEMO, id: 'fund_demo0002', funder: 'Startup India Seed Fund Scheme', type: 'Grant', amount: '500000', date: d(-6), status: 'Applied', notes: 'Applied through the incubator.', file_name: '', file_path: '', created_at: d(-6) },
)
put('INC_SchemeStatus', { email: DEMO, scheme_id: 'sisfs', status: 'Applied', updated_at: d(-6) })

// VAC Learner (own batch, so these classes are only ever shown to the demo account)
put('VAC_Learners', { email: DEMO, name: 'Aarav Sharma', roll_no: 'DEMO-001', program: 'B.Tech', semester: '6', course: 'Entrepreneurship', batch: DEMO_VAC_BATCH, faculty: 'Hub team' })
const VAC_PLAN = [[-10, 'Customer discovery'], [-6, 'Business model canvas'], [-2, 'Pricing & revenue models'], [3, 'Pitch storytelling']]
put('VAC_Sessions', VAC_PLAN.map(([off, title], i) => ({ session_id: `vac_demo_0${i + 1}`, date: d(off), time: '16:00', title, course: 'Entrepreneurship', batch: DEMO_VAC_BATCH })))
put('VAC_Assignments',
  { assignment_id: 'vas_demo0001', email: DEMO, title: 'Customer interview notes', due: d(-8), status: 'reviewed', link: file('vac', 'vas_demo0001', 'Interview-notes.pdf', 'Customer interview notes') },
  { assignment_id: 'vas_demo0002', email: DEMO, title: 'Business model canvas', due: d(-3), status: 'submitted', link: file('vac', 'vas_demo0002', 'Business-model-canvas.pdf', 'Business model canvas') },
  { assignment_id: 'vas_demo0003', email: DEMO, title: 'Pitch outline', due: d(5), status: 'pending', link: '' },
)
put('VAC_Feedback', { email: DEMO, area: 'course', rating: '5', comment: 'The customer-discovery session changed how I ran interviews.', submitted_date: d(-4) })

/* ---------------- run ---------------- */
const isDemoRow = (tab, o) => lc(o.email) === DEMO || lc(o.contact_email) === DEMO || (tab === 'VAC_Sessions' && o.batch === DEMO_VAC_BATCH)

async function main() {
  const headers = await ensureTabs(ALL_SCHEMAS)
  const { ids } = await tabIds()
  const tabs = Object.keys(ALL_SCHEMAS)
  const batch = await sheetsRequest(`/values:batchGet?${tabs.map((t) => `ranges=${q(t)}!A:ZZ`).join('&')}`)
  const values = Object.fromEntries(tabs.map((t, i) => [t, batch.valueRanges[i].values || []]))
  const objOf = (tab, r) => Object.fromEntries(headers[tab].map((h, i) => [h, String(r[i] ?? '').trim()]))

  if (values.Admins?.slice(1).some((r) => lc(objOf('Admins', r).email) === DEMO)) throw new Error(`${DEMO} is in the Admins tab; remove it by hand (the demo account must not be an admin).`)

  // 1. Login rows: upsert, keeping an existing password.
  const fallbackPassword = (process.env.DEMO_ACCOUNT_PASSWORD || '').trim()
  const loginRows = {
    [STUDENTS_TAB]: { email: DEMO, name: 'Aarav Sharma', memberships: PILLARS.filter((p) => !p.adminOnly).map((p) => `${p.id}:approved`).join(',') },
    Consultees: { email: DEMO, name: 'Aarav Sharma', department: 'Computer Science & Engineering', course: 'B.Tech', sem: '6', phone: '', startup_name: 'Re-Loop', created_date: d(-60) },
  }
  const updates = []
  const appends = []
  for (const tab of LOGIN_TABS) {
    const at = values[tab].findIndex((r, i) => i > 0 && lc(objOf(tab, r).email) === DEMO)
    const existing = at > 0 ? objOf(tab, values[tab][at]) : null
    const password = existing?.password || fallbackPassword
    if (!password) throw new Error(`No ${tab} row for ${DEMO} yet: set DEMO_ACCOUNT_PASSWORD in .env.local.`)
    const row = headers[tab].map((h) => ({ ...existing, ...loginRows[tab], password })[h] ?? '')
    if (at > 0) updates.push({ range: `'${tab}'!A${at + 1}`, values: [row] })
    else appends.push([tab, [row]])
  }

  // 2. Delete every other demo row (bottom-up per tab so row numbers stay valid).
  const deletes = []
  let deleted = 0
  for (const tab of tabs.filter((t) => !LOGIN_TABS.includes(t))) {
    values[tab].forEach((r, i) => {
      if (i > 0 && isDemoRow(tab, objOf(tab, r))) deletes.push({ sheetId: ids[tab], row: i })
    })
  }
  deletes.sort((a, b) => a.sheetId - b.sheetId || b.row - a.row)
  if (updates.length) await sheetsRequest('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: updates }) })
  if (deletes.length) {
    await sheetsRequest(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: deletes.map(({ sheetId, row }) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row, endIndex: row + 1 } } })) }),
    })
    deleted = deletes.length
  }

  // 3. Files: remove the demo account's old objects, upload the new ones.
  for (const pillar of FILE_PILLARS) {
    const prefix = `${pillar}/${DEMO}`
    const { data: folders, error: listErr } = await storage.list(prefix, { limit: 1000 })
    if (listErr) throw new Error(`storage list ${prefix}: ${listErr.message} (check SUPABASE_URL / SUPABASE_SECRET_KEY / bucket '${bucket}')`)
    for (const f of folders) {
      const { data: objs, error: subErr } = await storage.list(`${prefix}/${f.name}`, { limit: 1000 })
      if (subErr) throw new Error(`storage list ${prefix}/${f.name}: ${subErr.message}`)
      if (objs.length) await storage.remove(objs.map((o) => `${prefix}/${f.name}/${o.name}`))
    }
  }
  for (const { path, title } of files) {
    const { error } = await storage.upload(path, pdf(title), { contentType: 'application/pdf', upsert: true })
    if (error) throw new Error(`upload ${path}: ${error.message}`)
  }

  // 4. Append the fresh rows (one request per tab).
  for (const [tab, rows] of [...appends, ...Object.entries(seed).map(([t, rs]) => [t, rs.map((o) => headers[t].map((h) => String(o[h] ?? '')))])]) {
    await sheetsRequest(`/values/${q(tab)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: rows }) })
  }
  const written = Object.values(seed).reduce((n, rs) => n + rs.length, 0)
  console.log(`Demo account ${DEMO}: ${deleted} old rows removed, ${written} rows + ${files.length} files written across ${Object.keys(seed).length} tabs.`)
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
