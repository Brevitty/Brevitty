// "Brevity New Registration" spreadsheet (REGISTRATION_SHEET_ID). Same service account and
// token handling as the Hub sheet (sheetsClient.js); only the spreadsheet differs.

import { sheetsFetch, googleErrorText } from './sheetsClient.js'

const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

// option id -> tab name
export const REG_TABS = {
  'startup-junction': 'Startup Junction',
  'startup-arena': 'Startup Arena',
  mentorship: 'Mentorship',
  grants: 'Grants',
}

// Same columns on every tab. EMAIL_COL is the 0-based index used for the duplicate check.
export const REG_COLUMNS = [
  'Timestamp',
  'Name',
  'Phone',
  'Email',
  'College Student',
  'Campus',
  'Student Email',
  'Department',
  'Course',
  'Semester',
  'Campus Official Email',
  'Option Registered',
]
export const EMAIL_COL = REG_COLUMNS.indexOf('Email')

function requireRegSheetId() {
  const id = process.env.REGISTRATION_SHEET_ID?.trim()
  if (!id) throw new Error('Missing env var(s): REGISTRATION_SHEET_ID')
  return id
}

// Raw call for the setup script: `path` starts after the spreadsheet id, e.g. ':batchUpdate'.
export async function regRequest(path, init = {}) {
  const res = await sheetsFetch(`${SHEETS_URL}/${requireRegSheetId()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    const err = new Error(`Registration sheet ${init.method || 'GET'} failed: HTTP ${res.status} ${await googleErrorText(res)}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

const q = (tab) => encodeURIComponent(`'${tab}'`)

// Lower-cased emails already registered in this tab.
export async function registeredEmails(tab) {
  const col = String.fromCharCode(65 + EMAIL_COL)
  const data = await regRequest(`/values/${q(tab)}!${col}2:${col}?valueRenderOption=UNFORMATTED_VALUE`)
  return new Set((data.values || []).map((r) => String(r[0] ?? '').trim().toLowerCase()).filter(Boolean))
}

// RAW: Sheets stores every value as literal text, so nothing a visitor types (=, +, @ ...) is
// evaluated as a formula, and a phone number keeps its shape.
export async function appendRegRow(tab, rowValues) {
  await regRequest(`/values/${q(tab)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [rowValues] }),
  })
}
