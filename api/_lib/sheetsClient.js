// Shared Google Sheets service-account client for the tab readers/writers added
// after roster.js and attendanceSheet.js. Those two keep their own private
// copies of this same JWT/token/fetch dance (by instruction, not touched here);
// everything added since should use this instead of a third/fourth copy.

import crypto from 'crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_SKEW_MS = 60_000
const JWT_LIFETIME_S = 3600
const RETRY_DELAY_MS = 400

const CACHE_TTL_MS = 12_000 // 10-15s per spec
const STALE_MAX_MS = 60_000 // short grace period on a transient failure (these tabs aren't login-critical)
const FAILURE_BACKOFF_MS = 10_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const envSet = (k) => Boolean(process.env[k]?.trim())

export const cellToString = (v) => (v === undefined || v === null ? '' : String(v))
export const isChecked = (v) => cellToString(v).trim().toUpperCase() === 'TRUE'
export const todayISO = () => new Date().toISOString().slice(0, 10)

const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000
// A date typed by hand into a cell comes back from UNFORMATTED_VALUE as a serial number; seeds are RAW strings.
export const cellToISODate = (v) =>
  typeof v === 'number' ? new Date(SHEETS_EPOCH_MS + Math.floor(v) * MS_PER_DAY).toISOString().slice(0, 10) : cellToString(v).trim()

// Rows as objects keyed by the tab's own row-1 headers, so column order in the sheet doesn't matter.
export function rowsToObjects(values) {
  const headers = (values[0] || []).map((h) => cellToString(h).trim())
  return values.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])))
}

function normalisePrivateKey(raw) {
  return raw.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n')
}

function buildJwt(email, privateKey) {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + JWT_LIFETIME_S,
  })}`
  try {
    const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url')
    return `${unsigned}.${sig}`
  } catch {
    throw new Error('GOOGLE_PRIVATE_KEY is not a valid PEM private key')
  }
}

async function googleErrorText(res) {
  const text = await res.text().catch(() => '')
  try {
    const j = JSON.parse(text)
    return j.error?.message || j.error_description || (typeof j.error === 'string' ? j.error : '') || text.slice(0, 200)
  } catch {
    return text.slice(0, 200)
  }
}

let accessToken = null // { value, expiresAt }
let tokenInflight = null

async function fetchAccessToken() {
  const missing = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'].filter((k) => !envSet(k))
  if (missing.length) throw new Error(`Missing env var(s): ${missing.join(', ')}`)

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildJwt(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
      normalisePrivateKey(process.env.GOOGLE_PRIVATE_KEY)
    ),
  })
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (res.ok) {
      const data = await res.json()
      return { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
    }
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      await sleep(RETRY_DELAY_MS)
      continue
    }
    throw new Error(`Google token exchange failed: HTTP ${res.status} ${await googleErrorText(res)}`)
  }
}

async function getAccessToken() {
  if (accessToken && Date.now() < accessToken.expiresAt - TOKEN_SKEW_MS) return accessToken.value
  tokenInflight ??= fetchAccessToken()
    .then((t) => (accessToken = t).value)
    .finally(() => {
      tokenInflight = null
    })
  return tokenInflight
}

async function sheetsFetch(url, init = {}) {
  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken()
    const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
    const transient = res.status === 429 || res.status >= 500
    if (attempt === 0 && (transient || res.status === 401)) {
      if (res.status === 401) accessToken = null
      await sleep(transient ? RETRY_DELAY_MS : 0)
      continue
    }
    return res
  }
}

function requireSheetId() {
  if (!envSet('GOOGLE_SHEET_ID')) throw new Error('Missing env var(s): GOOGLE_SHEET_ID')
  return process.env.GOOGLE_SHEET_ID.trim()
}

// Raw Sheets API call on this spreadsheet, for the setup scripts (tab creation, batch
// writes, row deletion). `path` starts after the spreadsheet id, e.g. ':batchUpdate'.
export async function sheetsRequest(path, init = {}) {
  const res = await sheetsFetch(`${SHEETS_URL}/${requireSheetId()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`Sheets ${init.method || 'GET'} failed: HTTP ${res.status} ${await googleErrorText(res)}`)
  return res.json()
}

export async function readSheetRows(tabName, range = 'A:Z') {
  const sheetId = requireSheetId()
  const encodedRange = encodeURIComponent(`'${tabName}'!${range}`)
  const res = await sheetsFetch(`${SHEETS_URL}/${sheetId}/values/${encodedRange}?valueRenderOption=UNFORMATTED_VALUE`)
  if (!res.ok) throw new Error(`Sheets read failed: HTTP ${res.status} ${await googleErrorText(res)}`)
  return (await res.json()).values || []
}

// Appends one row at the end of the tab. RAW so nothing is reinterpreted as a formula/date.
export async function appendSheetRow(tabName, rowValues) {
  const sheetId = requireSheetId()
  const range = encodeURIComponent(`'${tabName}'!A:A`)
  const res = await sheetsFetch(`${SHEETS_URL}/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [rowValues] }),
  })
  if (!res.ok) throw new Error(`Sheets append failed: HTTP ${res.status} ${await googleErrorText(res)}`)
}

// Overwrites one row (1-based sheet row number) in place, A.. through `lastColLetter`.
export async function updateSheetRow(tabName, rowNumber, rowValues, lastColLetter) {
  const sheetId = requireSheetId()
  const range = encodeURIComponent(`'${tabName}'!A${rowNumber}:${lastColLetter}${rowNumber}`)
  const res = await sheetsFetch(`${SHEETS_URL}/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [rowValues] }),
  })
  if (!res.ok) throw new Error(`Sheets write failed: HTTP ${res.status} ${await googleErrorText(res)}`)
}

/* ---------------- per-tab TTL cache (10-15s), shared across all readers ---------------- */

const cacheByTab = new Map() // tab -> { rows, fetchedAt }
const inflightByTab = new Map()
const retryAfterByTab = new Map()
const generationByTab = new Map() // bumped on every write, so a read that started before the write never lands in the cache

function refreshTab(tabName, range) {
  if (inflightByTab.has(tabName)) return inflightByTab.get(tabName)
  const generation = generationByTab.get(tabName) || 0
  const p = readSheetRows(tabName, range)
    .then((rows) => {
      if ((generationByTab.get(tabName) || 0) === generation) cacheByTab.set(tabName, { rows, fetchedAt: Date.now() })
      retryAfterByTab.delete(tabName)
      return rows
    })
    .finally(() => {
      if (inflightByTab.get(tabName) === p) inflightByTab.delete(tabName)
    })
  inflightByTab.set(tabName, p)
  return p
}

export async function getCachedTab(tabName, range = 'A:Z') {
  const now = Date.now()
  const cached = cacheByTab.get(tabName)
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.rows
  const retryAfter = retryAfterByTab.get(tabName) || 0
  if (now >= retryAfter) {
    try {
      return await refreshTab(tabName, range)
    } catch (err) {
      retryAfterByTab.set(tabName, Date.now() + FAILURE_BACKOFF_MS)
      console.error(`[sheets:${tabName}] refresh failed: ${err.message}`)
    }
  }
  if (cached && now - cached.fetchedAt < STALE_MAX_MS) return cached.rows
  throw new Error(`${tabName} unavailable`)
}

// Call right after a write to that tab so the writer's own next read isn't stale.
export function invalidateTab(tabName) {
  cacheByTab.delete(tabName)
  inflightByTab.delete(tabName)
  generationByTab.set(tabName, (generationByTab.get(tabName) || 0) + 1)
}

// Re-reads the tab fresh (bypassing cache — stale row numbers must never be
// written to), finds the row whose `keyCols` all equal `keyValues`, and either
// overwrites it in place or appends a new one built by `buildRow(existingRowOrNull)`.
export async function upsertRow(tabName, keyCols, keyValues, buildRow, lastColLetter) {
  const values = await readSheetRows(tabName)
  const dataRows = values.slice(1)
  const rowIndex = dataRows.findIndex((r) => keyCols.every((col, i) => cellToString(r[col]).trim() === keyValues[i]))
  if (rowIndex === -1) {
    await appendSheetRow(tabName, buildRow(null))
  } else {
    await updateSheetRow(tabName, rowIndex + 2, buildRow(dataRows[rowIndex]), lastColLetter)
  }
  invalidateTab(tabName)
}
