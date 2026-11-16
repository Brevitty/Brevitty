// Full JSON backup of every tab (values, as the API returns them) into ./sheet-backup-<timestamp>/,
// one file per tab plus _tabs.json (order, ids, colours). Read-only.
//   node scripts/backup-sheet.mjs
import fs from 'fs'
import path from 'path'
import './lib/sheetSetup.mjs'
import { sheetsRequest } from '../api/_lib/sheetsClient.js'

const q = (t) => encodeURIComponent(`'${t.replace(/'/g, "''")}'`)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dir = path.resolve(`sheet-backup-${stamp}`)
fs.mkdirSync(dir)

const meta = await sheetsRequest('?fields=properties.title,sheets.properties(title,index,sheetId,tabColorStyle)')
const tabs = meta.sheets.map((s) => s.properties)
const batch = await sheetsRequest(`/values:batchGet?${tabs.map((t) => `ranges=${q(t.title)}!A:ZZ`).join('&')}`)
tabs.forEach((t, i) => {
  const values = batch.valueRanges[i].values || []
  fs.writeFileSync(path.join(dir, `${t.title}.json`), JSON.stringify({ title: t.title, rows: values.length, values }, null, 1))
})
fs.writeFileSync(path.join(dir, '_tabs.json'), JSON.stringify({ spreadsheet: meta.properties.title, tabs }, null, 1))
console.log(`Backed up ${tabs.length} tabs to ${dir}`)
