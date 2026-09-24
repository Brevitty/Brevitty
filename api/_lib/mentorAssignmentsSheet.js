// MentorAssignments tab reader (student's own rows, read-only). Columns:
// email | mentor_id | assigned_date
import { getCachedTab, cellToString } from './sheetsClient.js'

const TAB = 'MentorAssignments'
const EMAIL_COL = 0
const MENTOR_ID_COL = 1
const DATE_COL = 2

export async function getMentorAssignments(email) {
  const rows = (await getCachedTab(TAB)).slice(1)
  return rows
    .filter((r) => cellToString(r[EMAIL_COL]).trim() === email && cellToString(r[MENTOR_ID_COL]).trim())
    .map((r) => ({ mentor_id: cellToString(r[MENTOR_ID_COL]).trim(), assigned_date: cellToString(r[DATE_COL]).trim() || null }))
}
