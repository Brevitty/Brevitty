// Mentors tab reader (full directory, read-only). Columns:
// mentor_id | name | expertise | bio | contact_email
import { getCachedTab, cellToString } from './sheetsClient.js'

const TAB = 'Mentors'
const ID_COL = 0
const NAME_COL = 1
const EXPERTISE_COL = 2
const BIO_COL = 3
const EMAIL_COL = 4

export async function getMentors() {
  const rows = (await getCachedTab(TAB)).slice(1)
  return rows
    .filter((r) => cellToString(r[ID_COL]).trim())
    .map((r) => ({
      mentor_id: cellToString(r[ID_COL]).trim(),
      name: cellToString(r[NAME_COL]).trim(),
      expertise: cellToString(r[EXPERTISE_COL]).trim(),
      bio: cellToString(r[BIO_COL]).trim(),
      contact_email: cellToString(r[EMAIL_COL]).trim(),
    }))
}
