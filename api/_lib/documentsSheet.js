// Startup Junction Documents tab. Columns are read by header name:
// email | doc_id | status | submitted_date | file_url   (file_url holds the storage path)
// The catalogue (which documents exist) is code: src/data/documentsData.js.
import { rowsFor, upsert } from './pillarStore.js'
import { fail, istToday } from './consulting/rules.js'
import { checkUploaded, removeFile } from './files.js'
import { INCUBATION_DOCUMENTS, FUNDING_DOCUMENTS } from '../../src/data/documentsData.js'

const VALID_DOC_IDS = new Set([...INCUBATION_DOCUMENTS, ...FUNDING_DOCUMENTS].map((d) => d.id))
const VALID_STATUSES = new Set(['not_submitted', 'submitted', 'verified'])

function normaliseStatus(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_')
  return VALID_STATUSES.has(s) ? s : 'not_submitted'
}

// { doc_id: { status, date, file } } for every doc_id the sheet has a row for; a doc
// with no row (or an unrecognised status) reads as 'not_submitted', never a 500.
export async function getDocuments(email) {
  const documents = {}
  for (const r of await rowsFor('Documents', email)) {
    if (VALID_DOC_IDS.has(r.doc_id)) documents[r.doc_id] = { status: normaliseStatus(r.status), date: r.submitted_date || null, file: r.file_url || '' }
  }
  return documents
}

// body: { doc_id, file_path }. Upload or replace; a replaced file's old object is deleted.
// Verified documents are locked (the team verifies by typing "verified" into the sheet).
export async function saveDocument(email, body) {
  const docId = typeof body.doc_id === 'string' && VALID_DOC_IDS.has(body.doc_id) ? body.doc_id : fail(400, 'Unknown document.')
  const [existing] = (await rowsFor('Documents', email)).filter((r) => r.doc_id === docId)
  if (existing && normaliseStatus(existing.status) === 'verified') fail(409, 'This document is already verified.')
  const file = await checkUploaded(email, 'startup', body.file_path)
  await upsert('Documents', { email, doc_id: docId }, { status: 'submitted', submitted_date: istToday(), file_url: file })
  if (existing?.file_url !== file) await removeFile(existing?.file_url)
  return { documents: await getDocuments(email) }
}
