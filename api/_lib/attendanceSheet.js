// Attendance tab reader (wide format: A=name, B=email, C.. = one column per
// held session_id; cell values are "TRUE"/"FALSE" checkbox strings).
//
// The JWT/token/fetch/cache logic below is duplicated from roster.js rather
// than imported from it — roster.js is the Students reader and is off-limits
// to edit or export from for this change.

import crypto from 'crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TAB = 'Attendance'
const READ_RANGE = 'A:ZZ' // header + one row per student; wide enough for every held session column
const EMAIL_COL = 1 // column B

const CACHE_TTL_MS = 30_000
const STALE_MAX_MS = 5 * 60_000 // keep serving the last good read this long after it was fetched
const FAILURE_BACKOFF_MS = 10_000
const TOKEN_SKEW_MS = 60_000
const JWT_LIFETIME_S = 3600
const RETRY_DELAY_MS = 400

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const envSet = (k) => Boolean(process.env[k]?.trim())
const cellToString = (v) => (v === undefined || v === null ? '' : String(v))
const isChecked = (v) => cellToString(v).trim().toUpperCase() === 'TRUE'

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

async function sheetsFetch(url) {
  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken()
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const transient = res.status === 429 || res.status >= 500
    if (attempt === 0 && (transient || res.status === 401)) {
      if (res.status === 401) accessToken = null
      await sleep(transient ? RETRY_DELAY_MS : 0)
      continue
    }
    return res
  }
}

async function loadFromSheet() {
  if (!envSet('GOOGLE_SHEET_ID')) throw new Error('Missing env var(s): GOOGLE_SHEET_ID')
  const sheetId = process.env.GOOGLE_SHEET_ID.trim()
  const range = encodeURIComponent(`'${TAB}'!${READ_RANGE}`)
  const res = await sheetsFetch(`${SHEETS_URL}/${sheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`)
  if (!res.ok) throw new Error(`Sheets read failed: HTTP ${res.status} ${await googleErrorText(res)}`)

  const values = (await res.json()).values || []
  const headers = (values[0] || []).map((h) => cellToString(h).trim())
  // Column C (index 2) onward: one column per held session_id.
  const sessionCols = headers.slice(2).map((id, i) => ({ id, col: i + 2 })).filter((c) => c.id)
  return { sessionCols, rows: values.slice(1), fetchedAt: Date.now() }
}

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

async function getSheet() {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache
  if (now >= retryAfter) {
    try {
      return await refresh()
    } catch (err) {
      retryAfter = Date.now() + FAILURE_BACKOFF_MS
      console.error(`[attendance] Google Sheets refresh failed: ${err.message}`)
    }
  }
  if (cache && now - cache.fetchedAt < STALE_MAX_MS) {
    console.error('[attendance] Serving the last good attendance sheet (stale).')
    return cache
  }
  cache = null
  throw new Error('Attendance unavailable')
}

// heldIds: every session_id with a column in the sheet (held, regardless of student).
// presentById: for that column set, whether the given email's row has it checked
// (false, including when the email has no row at all — never throws for that case).
export async function getAttendance(email) {
  const { sessionCols, rows } = await getSheet()
  const studentRow = rows.find((r) => cellToString(r[EMAIL_COL]).trim() === email)
  const presentById = new Map(sessionCols.map((c) => [c.id, studentRow ? isChecked(studentRow[c.col]) : false]))
  return { heldIds: new Set(sessionCols.map((c) => c.id)), presentById }
}
