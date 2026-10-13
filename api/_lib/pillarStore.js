// Row access for the Launchpad / Incubation / VAC tabs. Columns are addressed by HEADER NAME
// (row 1), so the column order in the sheet never matters, same as scripts/lib/sheetSetup.mjs.
// Reads are cached (sheetsClient's short TTL); every write re-reads the tab fresh first, so a
// stale row number is never written to.
import crypto from 'crypto'
import { getCachedTab, readSheetRows, appendSheetRow, updateSheetRow, invalidateTab, cellToString, cellToISODate, warmTabs } from './sheetsClient.js'

// Prefetch every tab a page reads in one request (see sheetsClient.warmTabs).
export const warm = (tabs) => warmTabs(tabs)
import { sameEmail } from './consulting/rules.js'

const ID_BYTES = 4
const DATE_COLS = new Set(['date', 'deadline', 'assigned_date', 'completed_date', 'created_date', 'due', 'due_date', 'review_date', 'renewal_date', 'checked_date', 'submitted_date', 'mou_renewal'])

const colLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`)
const headerOf = (values) => (values[0] || []).map((h) => cellToString(h).trim())

// A hand-typed date comes back from Sheets as a serial number; everything else as trimmed text.
const toObjects = (values) => {
  const header = headerOf(values)
  return values.slice(1).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, DATE_COLS.has(h) ? cellToISODate(r[i]) : cellToString(r[i]).trim()]))
  )
}

export const newId = (prefix) => `${prefix}_${crypto.randomBytes(ID_BYTES).toString('hex')}`

export async function allRows(tab) {
  return toObjects(await getCachedTab(tab)).filter((r) => Object.values(r).some(Boolean))
}

export async function rowsFor(tab, email) {
  return (await allRows(tab)).filter((r) => sameEmail(r.email, email))
}

const matches = (row, keys) => Object.entries(keys).every(([k, v]) => (k === 'email' ? sameEmail(row[k], v) : row[k] === String(v)))

// Finds the row whose `keys` columns all match and merges `changes` into it, or appends
// keys+changes as a new row. Returns the row as written.
export async function upsert(tab, keys, changes) {
  const values = await readSheetRows(tab)
  const header = headerOf(values)
  const rows = toObjects(values)
  const i = rows.findIndex((r) => matches(r, keys))
  const merged = { ...(i >= 0 ? rows[i] : {}), ...keys, ...changes }
  const line = header.map((h) => cellToString(merged[h]))
  if (i >= 0) await updateSheetRow(tab, i + 2, line, colLetter(header.length - 1))
  else await appendSheetRow(tab, line)
  invalidateTab(tab)
  return Object.fromEntries(header.map((h) => [h, cellToString(merged[h])]))
}

// Updates an existing row only; null when no row matches (caller turns that into a 404).
export async function patchWhere(tab, keys, changes) {
  const values = await readSheetRows(tab)
  const rows = toObjects(values)
  if (!rows.some((r) => matches(r, keys))) return null
  return upsert(tab, keys, changes)
}

export async function append(tab, obj) {
  const header = headerOf(await readSheetRows(tab, '1:1'))
  await appendSheetRow(tab, header.map((h) => cellToString(obj[h])))
  invalidateTab(tab)
  return obj
}
