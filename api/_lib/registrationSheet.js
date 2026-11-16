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

// Columns on every tab. EMAIL_COL is the 0-based index used for the duplicate check.
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

// Startup Junction collects the On-Boarding Form answers too: appended to the RIGHT of REG_COLUMNS,
// so rows written before these existed stay valid. Team members 1-5 = Team Size 2-6 (founder excluded).
const TEAM_COLUMNS = [1, 2, 3, 4, 5].flatMap((n) => [`Team Member ${n}`, `Mobile ${n}`])
export const SJ_EXTRA_COLUMNS = [
  'Stage', 'Startup Name', 'One-liner', 'Industry', 'Description', 'Startup Email', 'Website',
  'Pitch Deck', 'Logo', 'Incubated Elsewhere', 'Incubated Where', 'Registered With', 'Registration Number',
  'Founder Photo', 'Founder Role', 'Team Size',
  ...TEAM_COLUMNS,
]

// Startup Arena: the startup's one-liner plus the deck and logo (storage paths, admin-viewable).
export const ARENA_EXTRA_COLUMNS = ['Startup Name', 'One-liner', 'Pitch Deck', 'Logo']

// Mentorship: built so an admin dashboard can be added later. "Preferred Date" holds a real date value
// (see sheetDateSerial); Status / Assigned Mentor / Admin Notes are for the team to fill in.
export const MENTORSHIP_EXTRA_COLUMNS = [
  'Registration ID', 'Preferred Date', 'Day', 'Slot', 'Slot Time', 'Status', 'Assigned Mentor', 'Admin Notes',
]
export const MENTORSHIP_STATUS_DEFAULT = 'Pending'
// The setup script formats these columns as dates.
export const REG_DATE_COLUMNS = { Mentorship: 'Preferred Date' }

const EXTRA_BY_OPTION = {
  'startup-junction': SJ_EXTRA_COLUMNS,
  'startup-arena': ARENA_EXTRA_COLUMNS,
  mentorship: MENTORSHIP_EXTRA_COLUMNS,
}

// tab -> full header row
export const REG_HEADERS = Object.fromEntries(
  Object.entries(REG_TABS).map(([option, tab]) => [tab, [...REG_COLUMNS, ...(EXTRA_BY_OPTION[option] || [])]])
)

// 1-based column number -> A1 letters (1 -> A, 27 -> AA)
export function colLetter(n) {
  let s = ''
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

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

// Mentorship allows several bookings per student: only the same email + date + slot is a duplicate.
// Returns a Set of "email|dateSerial|slot". Dates come back as day serials (UNFORMATTED_VALUE).
export async function bookedMentorshipKeys() {
  const cols = REG_HEADERS.Mentorship
  const letter = (name) => String.fromCharCode(65 + cols.indexOf(name))
  const emailAt = cols.indexOf('Email')
  const dateAt = cols.indexOf('Preferred Date') - emailAt
  const slotAt = cols.indexOf('Slot') - emailAt
  const data = await regRequest(`/values/${q('Mentorship')}!${letter('Email')}2:${letter('Slot')}?valueRenderOption=UNFORMATTED_VALUE`)
  return new Set(
    (data.values || [])
      .filter((r) => r[dateAt] !== undefined && r[dateAt] !== '')
      .map((r) => `${String(r[0] ?? '').trim().toLowerCase()}|${Number(r[dateAt])}|${String(r[slotAt] ?? '').trim()}`)
  )
}

// RAW: Sheets stores every value as literal text, so nothing a visitor types (=, +, @ ...) is
// evaluated as a formula, and a phone number keeps its shape.
export async function appendRegRow(tab, rowValues) {
  await regRequest(`/values/${q(tab)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [rowValues] }),
  })
}
