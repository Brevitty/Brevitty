// Tech-BIP 2027 registration backend. Reached through api/register.js (body.form === 'tech-bip'), because the
// project is capped at 12 functions. Same shape as the other registrations:
//   action "upload-url"  sign a direct-to-storage upload URL for the combined ID-card PDF
//   action "discard"     delete a submission's uploaded PDF after a failed attempt
//   (default)            re-validate everything, verify the stored PDF, append one row, return the registration ID
// The PDF goes to its own PRIVATE bucket (techbip-ids, PDF only, 50 MB); the row goes to the "Tech-BIP 2027" sheet.
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { clientIp, makeRateLimiter } from './http.js'
import { sheetsFetch, googleErrorText } from './sheetsClient.js'
import {
  BUCKET, MAX_PDF_BYTES, PDF_MAGIC, PDF_MIME, LIMITS, CITY_ZONE, COPY, TEAM_MAX,
  normaliseTechBip, techBipErrors, hasOverlongText, finalYearCount, oneLine,
} from '../../src/data/techBip.js'
import { EMAIL_RE } from '../../src/data/registrationOptions.js'

const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
export const TB_TAB = 'Registrations'
const HONEYPOT_FIELD = 'website'
const RATE_PER_MINUTE = 20 // campus Wi-Fi shares one IP between many students
const limited = makeRateLimiter(RATE_PER_MINUTE, 60_000)

const PDF_NAME = 'student-ids.pdf'
const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L
const ID_LENGTH = 6
const LINK_EXPIRY = Date.UTC(2027, 11, 31, 23, 59, 59) // ID-card links stay valid until 31 Dec 2027
const MAGIC_PROBE_SECONDS = 60
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MSG = {
  rate: 'Too many attempts. Give it a minute and try again.',
  invalid: 'Please check your details and try again.',
  unavailable: 'Registration is temporarily unavailable. Please try again in a few minutes.',
  pdf: 'The ID card PDF did not upload correctly. Please choose the file again and retry.',
}

// Column order of the "Registrations" tab. Rows are placed by header NAME, so a reordered sheet still lines up.
export const TB_HEADERS = [
  'Timestamp (IST)', 'Registration ID', 'Full Name', 'Mobile Number', 'Email ID', 'College / University', 'College City',
  'Final Year Student', 'Participation Type', 'Team Size',
  ...[2, 3, 4, 5].flatMap((n) => [`Member ${n} Name`, `Member ${n} Year`]),
  'Final Year Count', 'Idea Title', 'Technology Domain', 'Preferred City', 'Zone', 'ID Card PDF', 'ID Card Path', 'Consent',
]

/* ---------------- sheet ---------------- */

export function techBipSheetId() {
  const id = process.env.TECHBIP_SHEET_ID?.trim()
  if (!id) throw new Error('Missing env var(s): TECHBIP_SHEET_ID')
  return id
}
// `path` starts after the spreadsheet id, e.g. ':batchUpdate'. Also used by scripts/setup-techbip.mjs.
export async function techBipRequest(path, init = {}) {
  const res = await sheetsFetch(`${SHEETS_URL}/${techBipSheetId()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw Object.assign(new Error(`Tech-BIP sheet ${init.method || 'GET'} failed: HTTP ${res.status} ${await googleErrorText(res)}`), { sheetStatus: res.status })
  return res.json()
}

const tabRange = (range) => `/values/${encodeURIComponent(`'${TB_TAB}'`)}!${range}`
export const colLetter = (n) => {
  let s = ''
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
const HEADER_SPAN = 60
const readHeader = async () => ((await techBipRequest(tabRange(`A1:${colLetter(HEADER_SPAN)}1`))).values?.[0] || []).map((c) => String(c ?? '').trim())

async function registeredEmails() {
  const at = (await readHeader()).indexOf('Email ID')
  if (at < 0) throw new Error(`Tab "${TB_TAB}" has no "Email ID" column`)
  const col = colLetter(at + 1)
  const data = await techBipRequest(tabRange(`${col}2:${col}?valueRenderOption=UNFORMATTED_VALUE`))
  return new Set((data.values || []).map((r) => String(r[0] ?? '').trim().toLowerCase()).filter(Boolean))
}

// RAW: values are stored as literal text, so nothing a visitor types (=, +, @ ...) is evaluated as a formula.
async function appendRow(byName) {
  const header = await readHeader()
  const missing = TB_HEADERS.filter((h) => !header.includes(h))
  if (missing.length) throw new Error(`Tab "${TB_TAB}" is missing column(s): ${missing.join(', ')}`)
  const row = header.map((h) => (Object.hasOwn(byName, h) ? byName[h] : ''))
  await techBipRequest(`${tabRange('A:A')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [row] }) })
}

/* ---------------- storage ---------------- */

let client = null
export function techBipStorage() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) throw new Error('Missing env var(s): SUPABASE_URL / SUPABASE_SECRET_KEY')
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client.storage.from(BUCKET)
}
export const isSubmissionId = (v) => typeof v === 'string' && UUID_RE.test(v)
const pathFor = (submissionId) => `${submissionId}/${PDF_NAME}`
const bad = (msg) => {
  throw Object.assign(new Error(msg), { status: 400 })
}

async function removePdf(submissionId) {
  if (!isSubmissionId(submissionId)) return
  try {
    await techBipStorage().remove([pathFor(submissionId)])
  } catch (err) {
    console.error(`[tech-bip] could not clean up an uploaded file: ${err.message}`)
  }
}

// Throws .status 400 unless the stored object exists, is within the size limit and starts with "%PDF".
async function verifyPdf(submissionId) {
  const store = techBipStorage()
  const { data, error } = await store.list(submissionId, { limit: 20 })
  if (error) throw new Error(`storage list failed: ${error.message}`)
  const obj = (data || []).find((o) => o.name === PDF_NAME)
  const size = Number(obj?.metadata?.size)
  if (!obj || !(size > 0)) bad(MSG.pdf)
  if (size > MAX_PDF_BYTES) bad('The ID card PDF is larger than 50 MB.')
  if (String(obj.metadata?.mimetype || '') !== PDF_MIME) bad(MSG.pdf)

  // Read only the first bytes: a Range request, and if the server ignores it we stop after the first chunk.
  const signed = await store.createSignedUrl(pathFor(submissionId), MAGIC_PROBE_SECONDS)
  if (signed.error) throw new Error(`storage sign failed: ${signed.error.message}`)
  const res = await fetch(signed.data.signedUrl, { headers: { Range: `bytes=0-${PDF_MAGIC.length - 1}` } })
  if (!res.ok || !res.body) throw new Error(`storage read failed: HTTP ${res.status}`)
  const reader = res.body.getReader()
  const { value } = await reader.read()
  await reader.cancel().catch(() => {})
  if (!value || Buffer.from(value.slice(0, PDF_MAGIC.length)).toString('latin1') !== PDF_MAGIC) bad('That file is not a valid PDF.')
}

const newRegistrationId = () => `TBIP-${Array.from({ length: ID_LENGTH }, () => ID_ALPHABET[crypto.randomInt(ID_ALPHABET.length)]).join('')}`
const istTimestamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' })
const fail = (res, status, error, extra = {}) => res.status(status).json({ ok: false, error, ...extra })

/* ---------------- handler ---------------- */

export async function handleTechBip(req, res, body) {
  if (limited(clientIp(req))) return fail(res, 429, MSG.rate)
  const submissionId = isSubmissionId(body.submissionId) ? body.submissionId : ''

  if (body.action === 'discard') {
    await removePdf(submissionId)
    return res.status(200).json({ ok: true })
  }
  if (body.action !== undefined && body.action !== 'upload-url') return fail(res, 400, MSG.invalid)

  try {
    if (body.action === 'upload-url') {
      const email = oneLine(body.email, LIMITS.email).toLowerCase()
      const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
      const size = Number(body.size)
      if (!EMAIL_RE.test(email) || !filename || filename.length > LIMITS.filename || !/\.pdf$/i.test(filename)) return fail(res, 400, MSG.invalid)
      if (!(size > 0) || size > MAX_PDF_BYTES) return fail(res, 400, 'The ID card PDF must be a PDF up to 50 MB.')
      if (body.type && body.type !== PDF_MIME) return fail(res, 400, 'Only a PDF file is accepted.')
      // Refuse before the student spends minutes uploading 40+ MB for a registration that would be rejected.
      if ((await registeredEmails()).has(email)) return fail(res, 409, COPY.duplicate, { code: 'already_registered' })
      const id = submissionId || crypto.randomUUID()
      const { data, error } = await techBipStorage().createSignedUploadUrl(pathFor(id), { upsert: true })
      if (error) throw new Error(`storage sign upload failed: ${error.message}`)
      return res.status(200).json({ ok: true, data: { submissionId: id, upload_url: data.signedUrl, content_type: PDF_MIME } })
    }

    // Honeypot: pretend it worked, write nothing.
    if (typeof body[HONEYPOT_FIELD] === 'string' && body[HONEYPOT_FIELD].trim()) return res.status(200).json({ ok: true })

    // From here on, a failed submission removes the PDF it uploaded.
    const bail = async (status, error, extra) => {
      await removePdf(submissionId)
      return fail(res, status, error, extra)
    }
    if (hasOverlongText(body)) return bail(400, MSG.invalid)
    const v = normaliseTechBip(body)
    const errors = techBipErrors(v)
    if (Object.keys(errors).length) return bail(400, Object.keys(errors).length === 1 && errors.majority ? errors.majority : MSG.invalid)
    if (!submissionId) return bail(400, MSG.invalid)

    if ((await registeredEmails()).has(v.email)) return bail(409, COPY.duplicate, { code: 'already_registered' })
    await verifyPdf(submissionId)

    const path = pathFor(submissionId)
    const signed = await techBipStorage().createSignedUrl(path, Math.floor((LINK_EXPIRY - Date.now()) / 1000))
    if (signed.error) throw new Error(`storage sign failed: ${signed.error.message}`)

    const registrationId = newRegistrationId()
    const cells = {
      'Timestamp (IST)': istTimestamp(), 'Registration ID': registrationId, 'Full Name': v.name, 'Mobile Number': v.phone,
      'Email ID': v.email, 'College / University': v.college, 'College City': v.collegeCity, 'Final Year Student': v.finalYear,
      'Participation Type': v.participation, 'Team Size': v.teamSize,
      'Final Year Count': finalYearCount(v), 'Idea Title': v.ideaTitle, 'Technology Domain': v.domain, 'Preferred City': v.city,
      Zone: CITY_ZONE[v.city], 'ID Card PDF': signed.data.signedUrl, 'ID Card Path': path, Consent: 'Yes',
    }
    for (let n = 2; n <= TEAM_MAX; n++) {
      const m = v.members[n - 2]
      cells[`Member ${n} Name`] = m?.name ?? ''
      cells[`Member ${n} Year`] = m?.year ?? ''
    }
    await appendRow(cells)
    return res.status(200).json({ ok: true, data: { registrationId } })
  } catch (err) {
    if (err?.status === 400) {
      await removePdf(submissionId)
      return fail(res, 400, err.message)
    }
    console.error(`tech-bip: failed (${err.message})`) // no request data in the log line
    if (body.action !== 'upload-url') await removePdf(submissionId)
    return fail(res, 503, MSG.unavailable)
  }
}
