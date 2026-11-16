// Shared plumbing for the setup scripts: .env loading and tab/header setup. Rows are
// addressed by HEADER NAME, so the column order in the sheet never matters.
import { loadEnv } from 'vite'
import { sheetsRequest } from '../../api/_lib/sheetsClient.js'
import { addDays, istToday } from '../../api/_lib/consulting/rules.js'
import { RENAMED_TABS, TAB_GROUPS } from './tabGroups.mjs'

for (const [k, v] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (process.env[k] === undefined) process.env[k] = v
}

export function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]?.trim())
  if (missing.length) {
    console.error(`Missing env var(s): ${missing.join(', ')}. Set them in .env.local.`)
    process.exit(1)
  }
}

const q = (tab) => encodeURIComponent(`'${tab.replace(/'/g, "''")}'`)
const norm = (v) => String(v ?? '').trim()
const colLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`)

export async function tabIds() {
  const meta = await sheetsRequest('?fields=properties.title,sheets.properties(title,sheetId)')
  return { title: meta.properties.title, ids: Object.fromEntries(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId])) }
}

// Renames a tab in place (RENAMED_TABS) when the old name exists and the new one does not, so its rows are kept.
export async function renameTabs() {
  const { ids } = await tabIds()
  const requests = Object.entries(RENAMED_TABS)
    .filter(([from, to]) => from in ids && !(to in ids))
    .map(([from, to]) => ({ updateSheetProperties: { properties: { sheetId: ids[from], title: to }, fields: 'title' } }))
  if (!requests.length) return
  await sheetsRequest(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) })
  console.log(`Renamed tab(s): ${Object.entries(RENAMED_TABS).map(([f, t]) => `${f} -> ${t}`).join(', ')}`)
}

// Orders the tabs group by group (TAB_GROUPS) and colours each group. Tabs in no group go last.
export async function organiseTabs() {
  const { ids } = await tabIds()
  const requests = []
  let index = 0
  for (const g of TAB_GROUPS) {
    for (const tab of g.tabs.filter((t) => t in ids)) {
      requests.push({ updateSheetProperties: { properties: { sheetId: ids[tab], index: index++, tabColorStyle: { rgbColor: g.color } }, fields: 'index,tabColorStyle' } })
    }
  }
  if (requests.length) await sheetsRequest(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) })
  console.log(`Ordered and coloured ${requests.length} tabs in ${TAB_GROUPS.length} groups.`)
}

// Creates missing tabs and makes sure every expected header exists in row 1:
// blank row 1 -> write the full header; missing columns -> appended at the end of row 1
// (existing columns and data are never moved). Returns { tab: headerRow } for each tab.
export async function ensureTabs(schemas) {
  await renameTabs()
  const { ids } = await tabIds()
  const toCreate = Object.keys(schemas).filter((t) => !(t in ids))
  if (toCreate.length) {
    await sheetsRequest(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })) }),
    })
    console.log(`Created tab(s): ${toCreate.join(', ')}`)
  }
  const headers = {}
  // One batchGet for every header row (one read each would blow Google's 60 reads/min with 30+ tabs).
  const tabs = Object.keys(schemas)
  const batch = await sheetsRequest(`/values:batchGet?${tabs.map((t) => `ranges=${q(t)}!1:1`).join('&')}`)
  const rowOne = Object.fromEntries(tabs.map((t, i) => [t, batch.valueRanges[i]?.values?.[0] || []]))
  for (const [tab, expected] of Object.entries(schemas)) {
    const current = rowOne[tab].map(norm)
    const lower = current.map((h) => h.toLowerCase())
    const missing = expected.filter((h) => !lower.includes(h.toLowerCase()))
    if (missing.length) {
      const start = current.length
      await sheetsRequest(`/values/${q(tab)}!${colLetter(start)}1?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [missing] }),
      })
      console.log(`${tab}: ${start ? `added column(s) ${missing.join(', ')}` : 'wrote header row'}.`)
    }
    headers[tab] = [...current, ...missing]
  }
  return headers
}

// YYYY-MM-DD `n` days from today in IST, so "past"/"upcoming" seed rows stay true whenever you run this.
export const istDay = (n) => addDays(istToday(), n)

