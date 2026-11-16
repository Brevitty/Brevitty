// Creates the four registration tabs (if missing) in the "Brevity New Registration" sheet
// (REGISTRATION_SHEET_ID) and makes sure each header row has every expected column.
// Safe to re-run: it only ADDS tabs and appends missing columns to the right of the existing
// header (matched by name); it never rewrites, reorders or deletes anything, and never touches data rows.
//   node scripts/setup-registration-sheet.mjs
import { loadEnv } from 'vite'
import { regRequest, REG_TABS, REG_HEADERS, colLetter } from '../api/_lib/registrationSheet.js'

for (const [k, v] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (process.env[k] === undefined) process.env[k] = v
}
const missing = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'REGISTRATION_SHEET_ID'].filter((k) => !process.env[k]?.trim())
if (missing.length) {
  console.error(`Missing env var(s): ${missing.join(', ')}. Set them in .env.local.`)
  process.exit(1)
}

const q = (tab) => encodeURIComponent(`'${tab}'`)
const META_FIELDS = '?fields=properties.title,sheets.properties(title,sheetId,gridProperties.columnCount)'

let meta
try {
  meta = await regRequest(META_FIELDS)
} catch (err) {
  if (err.status === 403 || err.status === 404) {
    console.error(
      `Cannot open the registration sheet (HTTP ${err.status}). Share it with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Editor, then re-run.`
    )
  } else {
    console.error(err.message)
  }
  process.exit(1)
}
console.log(`Spreadsheet: "${meta.properties.title}"`)

const tabs = Object.values(REG_TABS)
const toAdd = tabs.filter((t) => !meta.sheets.some((s) => s.properties.title === t))
if (toAdd.length) {
  await regRequest(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })) }),
  })
  console.log(`Created tab(s): ${toAdd.join(', ')}`)
  meta = await regRequest(META_FIELDS)
}
const props = Object.fromEntries(meta.sheets.map((s) => [s.properties.title, s.properties]))

for (const tab of tabs) {
  const want = REG_HEADERS[tab]
  const { sheetId, gridProperties } = props[tab]
  const lastWanted = colLetter(want.length)
  const row1 = (await regRequest(`/values/${q(tab)}!A1:${colLetter(Math.max(want.length, gridProperties.columnCount))}1`)).values?.[0] || []
  const have = row1.map((c) => String(c).trim())

  // Columns to append = wanted names not already in the header, in wanted order, placed after the last used cell.
  const toAppend = want.filter((c) => !have.includes(c))
  const lastUsed = have.reduce((n, c, i) => (c ? i + 1 : n), 0)
  const needCols = lastUsed + toAppend.length

  if (toAppend.length) {
    if (gridProperties.columnCount < needCols) {
      // A sheet only has 26 columns by default; the API refuses writes past the grid.
      await regRequest(':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({
          requests: [{ updateSheetProperties: { properties: { sheetId, gridProperties: { columnCount: needCols } }, fields: 'gridProperties.columnCount' } }],
        }),
      })
    }
    const start = colLetter(lastUsed + 1)
    await regRequest(`/values/${q(tab)}!${start}1:${colLetter(needCols)}1?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [toAppend] }),
    })
    console.log(`"${tab}": ${lastUsed ? `added ${toAppend.length} column(s) from ${start}` : 'header written'}`)
  } else {
    console.log(`"${tab}": header already complete (${lastWanted})`)
  }

  // Bold + frozen header (idempotent; formatting only).
  await regRequest(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
      ],
    }),
  })
}
console.log('Done. Existing rows were not touched.')
