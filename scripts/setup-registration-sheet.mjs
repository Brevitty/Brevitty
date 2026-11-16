// Creates the four registration tabs (if missing) in the "Brevity New Registration" sheet
// (REGISTRATION_SHEET_ID), each with a bold, frozen header row. Never touches existing rows;
// a tab whose row 1 is blank gets the header. Run locally:
//   node scripts/setup-registration-sheet.mjs
import { loadEnv } from 'vite'
import { regRequest, REG_TABS, REG_COLUMNS } from '../api/_lib/registrationSheet.js'

for (const [k, v] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (process.env[k] === undefined) process.env[k] = v
}
const missing = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'REGISTRATION_SHEET_ID'].filter((k) => !process.env[k]?.trim())
if (missing.length) {
  console.error(`Missing env var(s): ${missing.join(', ')}. Set them in .env.local.`)
  process.exit(1)
}

const q = (tab) => encodeURIComponent(`'${tab}'`)

let meta
try {
  meta = await regRequest('?fields=properties.title,sheets.properties(title,sheetId)')
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

const ids = Object.fromEntries(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
const tabs = Object.values(REG_TABS)

const toAdd = tabs.filter((t) => !(t in ids))
if (toAdd.length) {
  const res = await regRequest(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })) }),
  })
  res.replies.forEach((r, i) => (ids[toAdd[i]] = r.addSheet.properties.sheetId))
  console.log(`Created tab(s): ${toAdd.join(', ')}`)
}

const lastCol = String.fromCharCode(64 + REG_COLUMNS.length) // 12 columns -> L
for (const tab of tabs) {
  const row1 = (await regRequest(`/values/${q(tab)}!A1:${lastCol}1`)).values?.[0] || []
  if (row1.some((c) => String(c).trim())) {
    console.log(`"${tab}": header already present, left as is`)
  } else {
    await regRequest(`/values/${q(tab)}!A1:${lastCol}1?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [REG_COLUMNS] }),
    })
    console.log(`"${tab}": header written`)
  }
  // Bold + frozen header (idempotent).
  await regRequest(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId: ids[tab], startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: ids[tab], gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    }),
  })
}
console.log('Done. Existing rows were not touched.')
