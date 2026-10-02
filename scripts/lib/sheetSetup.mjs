// Shared plumbing for the setup scripts: .env loading, tab/header setup, and keyed
// upserts of seed rows. Rows are written by HEADER NAME, so the column order in the
// sheet never matters. Everything is RAW (nothing is reinterpreted as a date/formula).
import { loadEnv } from 'vite'
import { sheetsRequest } from '../../api/_lib/sheetsClient.js'
import { addDays, istToday } from '../../api/_lib/consulting/rules.js'

for (const [k, v] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (process.env[k] === undefined) process.env[k] = v
}

export const DEMO_ACCOUNT_EMAIL = 'all@example.com'
// Second test student whose Consulting workspace is fully caught up (the "all clear" state).
export const CAUGHT_UP_EMAIL = 'caughtup@example.com'
export const isSeedAccount = (row) => [DEMO_ACCOUNT_EMAIL, CAUGHT_UP_EMAIL].includes(String(row.email || '').toLowerCase())
export const RESET_FLAG = '--reset-demo'
export const wantsReset = () => process.argv.includes(RESET_FLAG)

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

// Creates missing tabs and makes sure every expected header exists in row 1:
// blank row 1 -> write the full header; missing columns -> appended at the end of row 1
// (existing columns and data are never moved). Returns { tab: headerRow } for each tab.
export async function ensureTabs(schemas) {
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

// Upserts `rows` (objects keyed by header name) into `tab`, matching existing rows on `keyCols`.
//   default: append rows whose key is missing; leave existing ones alone (idempotent)
//   reset:   also overwrite existing ones with the seed values, and delete rows matched by
//            `pruneWhere(row)` whose key is not in the seed (e.g. rows a test run added)
export async function upsertRows(tab, header, rows, keyCols, { reset = false, pruneWhere = null, sheetTabId } = {}) {
  const values = (await sheetsRequest(`/values/${q(tab)}!A:ZZ`)).values || []
  const idx = Object.fromEntries(header.map((h, i) => [h.toLowerCase(), i]))
  const cell = (r, col) => norm(r[idx[col.toLowerCase()]])
  const keyOf = (get) => keyCols.map((c) => (c.toLowerCase().includes('email') ? get(c).toLowerCase() : get(c))).join('\u0001')
  const existing = new Map()
  values.slice(1).forEach((r, i) => existing.set(keyOf((c) => cell(r, c)), { r, sheetRow: i + 2 }))

  const toValues = (obj, base = []) => header.map((h, i) => (h in obj ? String(obj[h] ?? '') : base[i] ?? ''))
  const appends = []
  const updates = []
  const seedKeys = new Set()
  for (const obj of rows) {
    const key = keyOf((c) => norm(obj[c]))
    seedKeys.add(key)
    const hit = existing.get(key)
    if (!hit) appends.push(toValues(obj))
    else if (reset) updates.push({ range: `'${tab.replace(/'/g, "''")}'!A${hit.sheetRow}`, values: [toValues(obj, hit.r)] })
  }

  if (updates.length) {
    await sheetsRequest('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
    })
  }
  if (appends.length) {
    await sheetsRequest(`/values/${q(tab)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: appends }),
    })
  }

  let pruned = 0
  if (reset && pruneWhere) {
    const obj = (r) => Object.fromEntries(header.map((h, i) => [h, norm(r[i])]))
    const stale = [...existing.entries()]
      .filter(([key, { r }]) => !seedKeys.has(key) && pruneWhere(obj(r)))
      .map(([, { sheetRow }]) => sheetRow)
      .sort((a, b) => b - a) // bottom-up so earlier deletions don't shift later ones
    if (stale.length) {
      await sheetsRequest(':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({
          requests: stale.map((row) => ({
            deleteDimension: { range: { sheetId: sheetTabId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } },
          })),
        }),
      })
      pruned = stale.length
    }
  }
  console.log(`${tab}: ${appends.length} added, ${updates.length} reset, ${pruned} removed, ${rows.length - appends.length - updates.length} already present.`)
}

// Counts rows per tab whose `emailCol` is the demo account — the post-run verification.
export async function countDemoRows(tabs, emailCol = 'email') {
  const out = {}
  for (const tab of tabs) {
    const values = (await sheetsRequest(`/values/${q(tab)}!A:ZZ`)).values || []
    const i = (values[0] || []).map((h) => norm(h).toLowerCase()).indexOf(emailCol)
    out[tab] = i < 0 ? 0 : values.slice(1).filter((r) => norm(r[i]).toLowerCase() === DEMO_ACCOUNT_EMAIL).length
  }
  return out
}

// YYYY-MM-DD `n` days from today in IST, so "past"/"upcoming" seed rows stay true whenever you run this.
export const istDay = (n) => addDays(istToday(), n)

// The demo account's Students-tab memberships: every USER workspace in hubPillars.js, approved.
// Never an adminOnly one (Hub Admin comes only from the Admins tab).
export const demoMemberships = (pillars) => pillars.filter((p) => !p.adminOnly).map((p) => `${p.id}:approved`).join(',')
