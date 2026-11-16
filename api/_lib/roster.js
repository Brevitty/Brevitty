// Student roster, backed by a Google Sheet (service account, no SDK).
// Interface (async):
//   findStudent(email)               -> { email, password, name, memberships } | null   (exact, case-sensitive)
//                                       memberships: [{ pillar, status }]  (see hubPillars.js)
//   updatePassword(email, password)  -> void
//   countStudents() / summarizeRoster()  (diagnostics only; used by scripts/check-roster.mjs)
//
// Sheet: row 1 = headers; `email` and `password` columns are found by header name
// (case-insensitive, trimmed), so column order doesn't matter. Optional columns:
//   name         display name
//   memberships  "pillar:status,pillar:status"  e.g. "startup:approved,vac:pending"
//                statuses: approved | pending | rejected. A blank cell (or a missing
//                column) means the legacy default "startup:approved". The literal
//                value "none" means an account with no memberships at all.
//
// Fail-closed rules: if the roster can't be read (and there is no recent good copy),
// findStudent throws and nobody signs in. In production the local JSON file is NEVER
// used; it is a dev-only fallback when GOOGLE_SHEET_ID is unset.

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { MEMBERSHIP_STATUSES, isPillarId } from '../../src/data/hubPillars.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const DEFAULT_TAB = 'Students'
const READ_RANGE = 'A:Z' // ponytail: columns beyond Z are not read; widen if the sheet ever needs it
const HEADER_EMAIL = 'email'
const HEADER_PASSWORD = 'password'
const HEADER_NAME = 'name'
const HEADER_MEMBERSHIPS = 'memberships'
const NO_MEMBERSHIPS_TOKEN = 'none'
const LEGACY_MEMBERSHIPS = [{ pillar: 'startup', status: 'approved' }]

const CACHE_TTL_MS = 12_000 // 10-15s: stays under Google's 60 reads/min without hiding sheet edits for long
const STALE_MAX_MS = 5 * 60_000 // keep serving the last good roster this long after it was fetched
const FAILURE_BACKOFF_MS = 10_000 // don't hammer Google while it is failing
const TOKEN_SKEW_MS = 60_000 // refresh the access token a minute before it expires
const JWT_LIFETIME_S = 3600
const RETRY_DELAY_MS = 400

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isProduction = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)
const envSet = (k) => Boolean(process.env[k]?.trim())

/* ------------------------------------------------------------------ */
/* Google auth: service-account JWT -> access token (cached in memory) */
/* ------------------------------------------------------------------ */

let accessToken = null // { value, expiresAt }
let tokenInflight = null

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
    // deliberately no err.message: never risk echoing key material
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

// fetch with the bearer token; one short retry on 429/5xx, and on 401 (token revoked early).
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

/* ------------------------------------------------------------------ */
/* Sheet <-> roster                                                    */
/* ------------------------------------------------------------------ */

function sheetTarget() {
  if (!envSet('GOOGLE_SHEET_ID')) throw new Error('Missing env var(s): GOOGLE_SHEET_ID')
  const id = process.env.GOOGLE_SHEET_ID.trim()
  const tab = process.env.GOOGLE_SHEET_TAB?.trim() || DEFAULT_TAB
  return { id, quotedTab: `'${tab.replace(/'/g, "''")}'` }
}

// Parses a "pillar:status,pillar:status" cell. Invalid pairs are skipped with a
// warning that names only WHERE (never emails or passwords).
function parseMemberships(cell, where) {
  const text = cellToString(cell).trim()
  if (!text) return LEGACY_MEMBERSHIPS.map((m) => ({ ...m })) // blank cell / missing column => legacy student
  if (text.toLowerCase() === NO_MEMBERSHIPS_TOKEN) return []
  const out = []
  for (const part of text.split(',')) {
    if (!part.trim()) continue
    const [pillar, status, ...extra] = part.split(':').map((x) => x.trim().toLowerCase())
    if (extra.length || !isPillarId(pillar) || !MEMBERSHIP_STATUSES.includes(status)) {
      console.warn(`[roster] Ignored an invalid membership entry in ${where}.`)
      continue
    }
    if (!out.some((m) => m.pillar === pillar)) out.push({ pillar, status }) // first entry per pillar wins
  }
  return out
}

const publicStudent = (s) => ({
  email: s.email,
  password: s.password,
  name: s.name,
  memberships: s.memberships.map((m) => ({ ...m })),
})

const columnLetter = (i) => String.fromCharCode('A'.charCodeAt(0) + i) // i < 26 (range is A:Z)
const cellToString = (v) => (v === undefined || v === null ? '' : String(v))

async function loadFromSheet() {
  const { id, quotedTab } = sheetTarget()
  const range = encodeURIComponent(`${quotedTab}!${READ_RANGE}`)
  const res = await sheetsFetch(`${SHEETS_URL}/${id}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`)
  if (!res.ok) throw new Error(`Sheets read failed: HTTP ${res.status} ${await googleErrorText(res)}`)

  const values = (await res.json()).values || []
  const headers = (values[0] || []).map((h) => cellToString(h).trim().toLowerCase())
  const emailCol = headers.indexOf(HEADER_EMAIL)
  const passwordCol = headers.indexOf(HEADER_PASSWORD)
  const nameCol = headers.indexOf(HEADER_NAME) // optional
  const membershipsCol = headers.indexOf(HEADER_MEMBERSHIPS) // optional (-1 => everyone is legacy startup:approved)
  const absent = [
    emailCol < 0 && `"${HEADER_EMAIL}"`,
    passwordCol < 0 && `"${HEADER_PASSWORD}"`,
  ].filter(Boolean)
  if (absent.length) throw new Error(`Sheet row 1 is missing header column(s): ${absent.join(', ')}`)

  const students = new Map() // email -> { email, password, row }
  values.slice(1).forEach((cells, i) => {
    const row = i + 2 // 1-based sheet row
    const email = cellToString(cells[emailCol]).trim() // emails only: trim; passwords are never altered
    if (!email) return // blank row
    if (students.has(email)) {
      console.warn(`[roster] Duplicate email at sheet row ${row} ignored; using row ${students.get(email).row}.`)
      return
    }
    students.set(email, {
      email,
      password: cellToString(cells[passwordCol]),
      name: cellToString(cells[nameCol]).trim(),
      memberships: parseMemberships(cells[membershipsCol], `sheet row ${row}`),
      row,
    })
  })

  return { students, passwordColumn: columnLetter(passwordCol), quotedTab, sheetId: id, fetchedAt: Date.now() }
}

/* ------------------------------------------------------------------ */
/* Cache + failure policy                                              */
/* ------------------------------------------------------------------ */

let cache = null
let inflight = null
let retryAfter = 0

function refresh() {
  inflight ??= loadFromSheet()
    .then((r) => {
      cache = r
      retryAfter = 0
      return r
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

// Fresh (<12s) -> serve. Otherwise refresh; on failure keep serving the last good
// copy for up to 5 min after it was fetched, then fail closed.
async function getRoster() {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache
  if (now >= retryAfter) {
    try {
      return await refresh()
    } catch (err) {
      retryAfter = Date.now() + FAILURE_BACKOFF_MS
      console.error(`[roster] Google Sheets refresh failed: ${err.message}`)
    }
  }
  if (cache && now - cache.fetchedAt < STALE_MAX_MS) {
    console.error('[roster] Serving the last good roster (stale).')
    return cache
  }
  cache = null
  throw new Error('Roster unavailable') // generic on purpose; details are in the server log
}

async function sheetsFindStudent(email) {
  const s = (await getRoster()).students.get(email)
  return s ? publicStudent(s) : null
}

async function sheetsUpdatePassword(email, newPassword) {
  // Always re-read before writing: cached row numbers could be stale if rows were moved.
  // ponytail: read-then-write isn't atomic; a row edited in that split second could be hit. Fine at this scale.
  const roster = await refresh().catch((err) => {
    console.error(`[roster] Google Sheets refresh failed before update: ${err.message}`)
    throw new Error('Roster unavailable')
  })
  const student = roster.students.get(email)
  if (!student) throw new Error('Student not found')

  const range = encodeURIComponent(`${roster.quotedTab}!${roster.passwordColumn}${student.row}`)
  const res = await sheetsFetch(`${SHEETS_URL}/${roster.sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[newPassword]] }), // RAW: never parsed as a formula/number
  })
  if (!res.ok) {
    console.error(`[roster] Sheets write failed: HTTP ${res.status} ${await googleErrorText(res)}`)
    throw new Error('Could not update the roster')
  }
  student.password = newPassword // cache updated immediately so the re-issued cookie validates next request
}

/* ------------------------------------------------------------------ */
/* Dev-only fallback: local JSON file (never used in production)       */
/* ------------------------------------------------------------------ */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROSTER_PATH = path.join(__dirname, 'roster.local.json')

async function loadLocal() {
  let raw
  try {
    raw = await fs.promises.readFile(ROSTER_PATH, 'utf8')
  } catch {
    console.error(
      `[roster] GOOGLE_SHEET_ID is not set and ${ROSTER_PATH} is missing. Copy api/_lib/roster.example.json to roster.local.json (dev) or configure Google Sheets. Sign-in is disabled.`
    )
    return []
  }
  try {
    const rows = JSON.parse(raw)
    if (!Array.isArray(rows)) throw new Error('not an array')
    return rows
      .filter((r) => r && typeof r.email === 'string' && typeof r.password === 'string')
      .map((r, i) => ({
        email: r.email,
        password: r.password,
        name: typeof r.name === 'string' ? r.name.trim() : '',
        memberships: parseMemberships(r.memberships, `local roster entry ${i + 1}`),
      }))
  } catch (err) {
    console.error('[roster] roster.local.json is not a valid JSON array of {email,password}:', err.message)
    return []
  }
}

async function localFindStudent(email) {
  const row = (await loadLocal()).find((r) => r.email === email)
  return row ? publicStudent(row) : null
}

async function localUpdatePassword(email, newPassword) {
  // Edit the raw file rows (not the parsed ones) so name/memberships are written back untouched.
  const rows = JSON.parse(await fs.promises.readFile(ROSTER_PATH, 'utf8'))
  const row = rows.find((r) => r && r.email === email)
  if (!row) throw new Error('Student not found')
  row.password = newPassword
  const tmp = `${ROSTER_PATH}.tmp`
  await fs.promises.writeFile(tmp, JSON.stringify(rows, null, 2))
  await fs.promises.rename(tmp, ROSTER_PATH)
}

/* ------------------------------------------------------------------ */
/* Public interface                                                    */
/* ------------------------------------------------------------------ */

const useLocalFile = () => !isProduction() && !envSet('GOOGLE_SHEET_ID')

export async function findStudent(email) {
  if (typeof email !== 'string') return null
  return useLocalFile() ? localFindStudent(email) : sheetsFindStudent(email)
}

export async function updatePassword(email, newPassword) {
  return useLocalFile() ? localUpdatePassword(email, newPassword) : sheetsUpdatePassword(email, newPassword)
}

// Diagnostics only (scripts/check-roster.mjs) — not part of the auth interface.
async function allStudents() {
  return useLocalFile() ? loadLocal() : [...(await getRoster()).students.values()]
}

export async function countStudents() {
  return (await allStudents()).length
}

// Counts only — no emails, names or passwords.
export async function summarizeRoster() {
  const students = await allStudents()
  const byStatus = Object.fromEntries(MEMBERSHIP_STATUSES.map((st) => [st, 0]))
  const byPillar = {}
  let withoutMemberships = 0
  for (const st of students) {
    if (!st.memberships.length) withoutMemberships++
    for (const m of st.memberships) {
      byStatus[m.status]++
      byPillar[m.pillar] = (byPillar[m.pillar] || 0) + 1
    }
  }
  return { students: students.length, withoutMemberships, byStatus, byPillar }
}

// Used by Hub Admin: parse a memberships cell the same way sign-in does, and drop the 12s cache after
// the admin writes the Students tab so a new/edited user can sign in immediately.
export const membershipsOf = (cell) => parseMemberships(cell, 'the Students tab')
export function invalidateRoster() {
  cache = null
}
