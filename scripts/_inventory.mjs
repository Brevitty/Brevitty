import './lib/sheetSetup.mjs'
import { sheetsRequest } from '../api/_lib/sheetsClient.js'
import fs from 'node:fs'
const meta = await sheetsRequest('?fields=sheets.properties(title,sheetId)')
const tabs = meta.sheets.map((s) => s.properties.title)
const q = (t) => encodeURIComponent(`'${t.replace(/'/g, "''")}'`)
const batch = await sheetsRequest(`/values:batchGet?${tabs.map((t) => `ranges=${q(t)}!A:ZZ`).join('&')}`)
const out = {}
tabs.forEach((t, i) => { out[t] = batch.valueRanges[i].values || [] })
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1))
for (const t of tabs) {
  const v = out[t]; const h = (v[0] || []).map((x) => String(x).trim().toLowerCase())
  const emailCols = h.map((x, i) => [x, i]).filter(([x]) => x.includes('email'))
  const emails = {}
  for (const r of v.slice(1)) for (const [, i] of emailCols) { const e = String(r[i] ?? '').trim().toLowerCase(); if (e) emails[e] = (emails[e] || 0) + 1 }
  console.log(`${t} [${v.length - 1} rows] ${h.join(',')}\n   ${JSON.stringify(emails)}`)
}
