// ONE-OFF: deletes every tab the app does not use. DRY RUN by default; --apply deletes.
//   node scripts/_clean-tabs.mjs            # prints what it WOULD delete
//   node scripts/_clean-tabs.mjs --apply    # deletes (needs a sheet-backup-* folder, see backup-sheet.mjs)
// A tab is kept if it is in the schema (scripts/lib/schemas.js) or is a pending-rename alias. Retired tabs
// are deleted; any other unused tab holding a real (non-@example.com) email is refused.
import fs from 'fs'
import './lib/sheetSetup.mjs'
import { sheetsRequest } from '../api/_lib/sheetsClient.js'
import { ALL_SCHEMAS, STUDENTS_TAB } from './lib/schemas.js'

const APPLY = process.argv.includes('--apply')
const RETIRED = new Set(['Attendance', 'Mentors', 'MentorAssignments', 'LP_Mentors', 'VAC_Attendance'])
const NEVER_DELETE = new Set([STUDENTS_TAB, 'Admins'])
const RENAMED_FROM = new Set(['MentorSessions']) // becomes CohortSessions via setup-sheets.js; never delete it
const q = (t) => encodeURIComponent(`'${t.replace(/'/g, "''")}'`)
const isRealEmail = (v) => /\S+@\S+/.test(String(v)) && !/@example\.com\s*$/i.test(String(v))

const meta = await sheetsRequest('?fields=sheets.properties(title,sheetId)')
const tabs = meta.sheets.map((s) => s.properties)
const batch = await sheetsRequest(`/values:batchGet?${tabs.map((t) => `ranges=${q(t.title)}!A:ZZ`).join('&')}`)

const plan = []
const refused = []
tabs.forEach((t, i) => {
  if (t.title in ALL_SCHEMAS || NEVER_DELETE.has(t.title) || RENAMED_FROM.has(t.title)) return
  const [header = [], ...rows] = batch.valueRanges[i].values || []
  const data = rows.filter((r) => r.some((c) => String(c).trim()))
  const emailCols = header.map((h, j) => (/email/i.test(h) ? j : -1)).filter((j) => j >= 0)
  const real = data.filter((r) => emailCols.some((j) => isRealEmail(r[j]))).length
  const entry = { title: t.title, sheetId: t.sheetId, rows: data.length, why: RETIRED.has(t.title) ? 'retired' : 'unreferenced' }
  if (real && !RETIRED.has(t.title)) refused.push({ ...entry, real })
  else plan.push(entry)
})

console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${plan.length} tab(s) to delete, ${tabs.length - plan.length} kept`)
for (const p of plan) console.log(`  delete  ${p.title.padEnd(18)} ${String(p.rows).padStart(3)} data row(s)  [${p.why}]`)
for (const r of refused) console.log(`  REFUSED ${r.title} has ${r.real} real-user row(s); not deleted`)
if (!APPLY) process.exit(0)

if (!fs.readdirSync('.').some((f) => f.startsWith('sheet-backup-'))) {
  console.error('No sheet-backup-* folder found. Run: node scripts/backup-sheet.mjs')
  process.exit(1)
}
if (!plan.length) process.exit(0)
await sheetsRequest(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: plan.map((p) => ({ deleteSheet: { sheetId: p.sheetId } })) }) })
console.log('Deleted.')
