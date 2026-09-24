// Documents tab reader (read-only — uploads are out of scope). Columns:
// email | doc_id | status | submitted_date
import { getCachedTab, cellToString } from './sheetsClient.js'
import { INCUBATION_DOCUMENTS, FUNDING_DOCUMENTS } from '../../src/data/documentsData.js'

const TAB = 'Documents'
const EMAIL_COL = 0
const DOC_ID_COL = 1
const STATUS_COL = 2
const DATE_COL = 3

const VALID_DOC_IDS = new Set([...INCUBATION_DOCUMENTS, ...FUNDING_DOCUMENTS].map((d) => d.id))
const VALID_STATUSES = new Set(['not_submitted', 'submitted', 'verified'])

function normaliseStatus(v) {
  const s = cellToString(v).trim().toLowerCase().replace(/\s+/g, '_')
  return VALID_STATUSES.has(s) ? s : 'not_submitted'
}

// { doc_id: { status, date } } for every doc_id the sheet has a row for; a doc
// with no row (or an unrecognised status) reads as 'not_submitted', never a 500.
export async function getDocuments(email) {
  const rows = (await getCachedTab(TAB)).slice(1)
  const documents = {}
  for (const r of rows) {
    if (cellToString(r[EMAIL_COL]).trim() !== email) continue
    const docId = cellToString(r[DOC_ID_COL]).trim()
    if (VALID_DOC_IDS.has(docId)) {
      documents[docId] = { status: normaliseStatus(r[STATUS_COL]), date: cellToString(r[DATE_COL]).trim() || null }
    }
  }
  return documents
}
