// One-off, idempotent setup: creates the empty tracking tabs for Startup
// Junction (ChecklistStatus, Attendance, Documents, SessionProgress, Mentors,
// MentorAssignments) in the same "Startup Junction" Google Sheet the roster
// already reads from (GOOGLE_SHEET_ID), using the same service account.
//
// Safe to re-run: skips any tab that already exists, and only writes a header
// row into a tab whose row 1 is currently blank (never overwrites row 1 if
// it already holds something, even if it doesn't match — that's a sign
// someone else already set it up differently, so this script backs off and
// says so instead of guessing).
//
// Does NOT touch the existing Students tab.
//
// Usage: node scripts/setup-startup-junction-tabs.mjs

import { loadEnv } from 'vite'
import crypto from 'node:crypto'

for (const [k, v] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (process.env[k] === undefined) process.env[k] = v
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

const TABS = {
  ChecklistStatus: ['email', 'item_id', 'checked', 'checked_date'],
  Attendance: ['email', 'session_id', 'date', 'status'],
  Documents: ['email', 'doc_id', 'status', 'submitted_date'],
  SessionProgress: ['email', 'session_id', 'completed', 'quiz_score', 'completed_date'],
  Mentors: ['mentor_id', 'name', 'expertise', 'bio', 'contact_email'],
  MentorAssignments: ['email', 'mentor_id', 'assigned_date'],
}

function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]?.trim())
  if (missing.length) {
    console.error(`Missing env var(s): ${missing.join(', ')}. Set them in .env.local.`)
    process.exit(1)
  }
}
requireEnv(['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID'])

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
    exp: now + 3600,
  })}`
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url')
  return `${unsigned}.${sig}`
}

async function googleErrorText(res) {
  const text = await res.text().catch(() => '')
  try {
    const j = JSON.parse(text)
    return j.error?.message || text.slice(0, 300)
  } catch {
    return text.slice(0, 300)
  }
}

async function getAccessToken() {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildJwt(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(), normalisePrivateKey(process.env.GOOGLE_PRIVATE_KEY)),
  })
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!res.ok) throw new Error(`Google token exchange failed: HTTP ${res.status} ${await googleErrorText(res)}`)
  return (await res.json()).access_token
}

async function main() {
  const sheetId = process.env.GOOGLE_SHEET_ID.trim()
  const token = await getAccessToken()
  const authed = (url, init = {}) => fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })

  const metaRes = await authed(`${SHEETS_URL}/${sheetId}?fields=sheets.properties.title`)
  if (!metaRes.ok) throw new Error(`Could not read spreadsheet: HTTP ${metaRes.status} ${await googleErrorText(metaRes)}`)
  const existingTitles = new Set((await metaRes.json()).sheets.map((s) => s.properties.title))

  const toCreate = Object.keys(TABS).filter((name) => !existingTitles.has(name))
  if (toCreate.length) {
    const res = await authed(`${SHEETS_URL}/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })) }),
    })
    if (!res.ok) throw new Error(`Could not create tab(s): HTTP ${res.status} ${await googleErrorText(res)}`)
    console.log(`Created tab(s): ${toCreate.join(', ')}`)
  } else {
    console.log('All tabs already exist — nothing to create.')
  }

  // Check row 1 of every target tab (not just the ones just created) so a
  // prior partial run — tab created but header write failed — is repaired.
  const ranges = Object.keys(TABS).map((name) => `'${name}'!A1:Z1`)
  const getUrl = `${SHEETS_URL}/${sheetId}/values:batchGet?${ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')}`
  const rowsRes = await authed(getUrl)
  if (!rowsRes.ok) throw new Error(`Could not read header rows: HTTP ${rowsRes.status} ${await googleErrorText(rowsRes)}`)
  const rowsByRange = (await rowsRes.json()).valueRanges

  const data = []
  Object.keys(TABS).forEach((name, i) => {
    const currentRow = rowsByRange[i]?.values?.[0] || []
    if (currentRow.length === 0) {
      data.push({ range: `'${name}'!A1`, values: [TABS[name]] })
    } else {
      const expected = TABS[name].join(',').toLowerCase()
      const actual = currentRow.map((c) => String(c).trim()).join(',').toLowerCase()
      console.log(
        actual === expected
          ? `${name}: header row already set — skipping.`
          : `${name}: row 1 already has content that doesn't match the expected header — leaving it alone. Check it manually.`
      )
    }
  })

  if (data.length) {
    const res = await authed(`${SHEETS_URL}/${sheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data }),
    })
    if (!res.ok) throw new Error(`Could not write header row(s): HTTP ${res.status} ${await googleErrorText(res)}`)
    console.log(`Wrote header row for: ${data.map((d) => d.range.split('!')[0].replace(/'/g, '')).join(', ')}`)
  }

  console.log('Done. Students tab was not touched.')
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
