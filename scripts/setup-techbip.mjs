// Tech-BIP 2027 setup. Idempotent: verifies sheet access, creates the "Registrations" tab with a bold frozen
// header (other tabs are left alone; missing columns are appended, nothing is rewritten), and creates/updates
// the private "techbip-ids" storage bucket (PDF only, 50 MB).
//   node scripts/setup-techbip.mjs
import './lib/sheetSetup.mjs' // loads .env.local
import { createClient } from '@supabase/supabase-js'
import { techBipRequest, TB_TAB, TB_HEADERS, colLetter } from '../api/_lib/techBip.js'
import { BUCKET, MAX_PDF_BYTES, PDF_MIME } from '../src/data/techBip.js'

const missing = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'TECHBIP_SHEET_ID', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'].filter((k) => !process.env[k]?.trim())
if (missing.length) {
  console.error(`Missing env var(s): ${missing.join(', ')}. Set them in .env.local.`)
  process.exit(1)
}

const META = '?fields=properties.title,sheets.properties(title,sheetId,gridProperties.columnCount)'
let meta
try {
  meta = await techBipRequest(META)
} catch (err) {
  const hint = err.sheetStatus === 404 ? ' (not found: check TECHBIP_SHEET_ID)' : err.sheetStatus === 403 ? ` (share it with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Editor)` : ''
  console.error(`Cannot open the Tech-BIP sheet${hint}: ${err.message}`)
  process.exit(1)
}
console.log(`Spreadsheet: "${meta.properties.title}"`)

const batch = (requests) => techBipRequest(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) })
if (!meta.sheets.some((s) => s.properties.title === TB_TAB)) {
  await batch([{ addSheet: { properties: { title: TB_TAB } } }])
  console.log(`Created tab "${TB_TAB}"`)
  meta = await techBipRequest(META)
}
const { sheetId, gridProperties } = meta.sheets.find((s) => s.properties.title === TB_TAB).properties
const range = (a) => `/values/${encodeURIComponent(`'${TB_TAB}'`)}!${a}`
const have = ((await techBipRequest(range(`A1:${colLetter(Math.max(TB_HEADERS.length, gridProperties.columnCount))}1`))).values?.[0] || []).map((c) => String(c).trim())
const toAppend = TB_HEADERS.filter((h) => !have.includes(h))
const lastUsed = have.reduce((n, c, i) => (c ? i + 1 : n), 0)
if (toAppend.length) {
  const needCols = lastUsed + toAppend.length
  if (gridProperties.columnCount < needCols) {
    await batch([{ updateSheetProperties: { properties: { sheetId, gridProperties: { columnCount: needCols } }, fields: 'gridProperties.columnCount' } }])
  }
  await techBipRequest(range(`${colLetter(lastUsed + 1)}1:${colLetter(needCols)}1?valueInputOption=RAW`), { method: 'PUT', body: JSON.stringify({ values: [toAppend] }) })
  console.log(`"${TB_TAB}": added ${toAppend.length} header column(s)`)
} else {
  console.log(`"${TB_TAB}": header already complete`)
}
await batch([
  { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
  { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
])

const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } })
const options = { public: false, fileSizeLimit: MAX_PDF_BYTES, allowedMimeTypes: [PDF_MIME] }
const { data: existing } = await supabase.storage.getBucket(BUCKET)
const { error } = existing ? await supabase.storage.updateBucket(BUCKET, options) : await supabase.storage.createBucket(BUCKET, options)
if (error) {
  console.error(`Could not ${existing ? 'update' : 'create'} bucket "${BUCKET}": ${error.message}`)
  process.exit(1)
}
const { data } = await supabase.storage.getBucket(BUCKET)
console.log(`Bucket "${BUCKET}" ${existing ? 'updated' : 'created'}: public=${data.public}, limit=${data.file_size_limit} bytes, types=${data.allowed_mime_types.join(',')}`)
