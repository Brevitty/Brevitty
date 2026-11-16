// Creates every missing Hub tab and any missing header column in the Google Sheet the app reads
// (GOOGLE_SHEET_ID, same service account as the roster). Never touches existing rows or columns:
// a blank row 1 gets the full header, a missing column is appended at the end.
// Also renames retired names in place and orders + colours the tabs by pillar (scripts/lib/tabGroups.mjs).
//   node scripts/setup-sheets.js
import { ensureTabs, organiseTabs, requireEnv, tabIds } from './lib/sheetSetup.mjs'
import { ALL_SCHEMAS } from './lib/schemas.js'

requireEnv(['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID'])

const { title } = await tabIds()
console.log(`Spreadsheet: "${title}" (${Object.keys(ALL_SCHEMAS).length} tabs in the schema)`)
await ensureTabs(ALL_SCHEMAS) // also renames MentorSessions -> CohortSessions in place
await organiseTabs()
console.log('Done. Existing rows were not touched.')
