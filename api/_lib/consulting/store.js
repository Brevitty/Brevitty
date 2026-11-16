// The one data-access layer for the consulting tabs. Everything else talks to
// these functions, never to Sheets directly. Rows are addressed by id (the
// tab's key column), never by remembered row number.
//
// Reads: cached (short TTL, see sheetsClient) for display; `fresh` for anything
// that precedes a write. Writes invalidate the tab's cache.

import crypto from 'crypto'
import {
  getCachedTab, readSheetRows, appendSheetRow, updateSheetRow, invalidateTab, cellToString,
} from '../sheetsClient.js'
import { TABS, KEY_COL, DATE_COLS, TIME_COLS } from '../../../src/data/consultingConstants.js'
import { sameEmail } from './rules.js'

const ID_BYTES = 4
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000
const MIN_PER_DAY = 1440
const ID_PREFIX = { ConsultingSessions: 'ses', Tasks: 'tsk', Deliverables: 'dlv' }

const colLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`)
const headerOf = (values) => (values[0] || []).map((h) => cellToString(h).trim())

// If sir types 2026-10-05 into a cell Sheets may turn it into a date serial;
// UNFORMATTED_VALUE then hands us a number. Normalise back to our string formats.
function readCell(col, v) {
  if (typeof v === 'number') {
    if (DATE_COLS.includes(col)) return new Date(SHEETS_EPOCH_MS + Math.floor(v) * MS_PER_DAY).toISOString().slice(0, 10)
    if (TIME_COLS.includes(col)) {
      const min = Math.round((v % 1) * MIN_PER_DAY)
      return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    }
  }
  return cellToString(v).trim()
}

// Columns are found by their row-1 header name, so the sheet's column order never matters.
// _header/_raw ride along so a write keeps any column this code doesn't know about.
const toObject = (tab, header, row, sheetRow) => {
  const obj = { _row: sheetRow, _header: header, _raw: row }
  for (const col of TABS[tab]) obj[col] = readCell(col, row[header.indexOf(col)])
  return obj
}
const toValues = (tab, header, obj) => header.map((h, i) => (TABS[tab].includes(h) ? obj[h] ?? '' : obj._raw?.[i] ?? ''))

// Drops the internal row pointer (and the password unless asked to keep it).
export function pub(obj, { keepPassword = false } = {}) {
  const { _row, _header, _raw, ...rest } = obj
  if (!keepPassword) delete rest.password
  return rest
}

export const newId = (tab) => `${ID_PREFIX[tab]}_${crypto.randomBytes(ID_BYTES).toString('hex')}`

export async function list(tab, { fresh = false } = {}) {
  const values = fresh ? await readSheetRows(tab) : await getCachedTab(tab)
  return values
    .slice(1)
    .map((row, i) => toObject(tab, headerOf(values), row, i + 2))
    .filter((o) => o[KEY_COL[tab]]) // blank (deleted) rows have no key
}

const matches = (tab, o, id) => (tab === 'Consultees' || tab === 'Admins' ? sameEmail(o.email, id) : o[KEY_COL[tab]] === id)

export async function find(tab, id) {
  if (!id || typeof id !== 'string') return null
  return (await list(tab, { fresh: true })).find((o) => matches(tab, o, id)) ?? null
}

export async function insert(tab, obj) {
  const header = headerOf(await readSheetRows(tab, '1:1'))
  await appendSheetRow(tab, toValues(tab, header, obj))
  invalidateTab(tab)
  return obj
}

// Returns the updated row, or null when the id doesn't exist. Pass `existing` (a row this
// request just read fresh) to skip a second read and save Sheets quota.
export async function patch(tab, id, changes, existing = null) {
  existing ??= await find(tab, id)
  if (!existing) return null
  const next = { ...existing, ...changes }
  await updateSheetRow(tab, existing._row, toValues(tab, existing._header, next), colLetter(existing._header.length - 1))
  invalidateTab(tab)
  return next
}

// ponytail: "delete" blanks the row (sheetsClient has no row-delete); readers skip
// keyless rows, so it disappears from the app. Sir can delete blank rows by hand.
export async function remove(tab, id) {
  const existing = await find(tab, id)
  if (!existing) return false
  await updateSheetRow(tab, existing._row, existing._header.map(() => ''), colLetter(existing._header.length - 1))
  invalidateTab(tab)
  return true
}
