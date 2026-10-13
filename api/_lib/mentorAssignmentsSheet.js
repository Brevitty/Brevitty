// MentorAssignments tab reader (the student's own rows, read-only). Columns by header name:
// email | mentor_id | assigned_date
import { rowsFor } from './pillarStore.js'

export async function getMentorAssignments(email) {
  return (await rowsFor('MentorAssignments', email))
    .filter((r) => r.mentor_id)
    .map((r) => ({ mentor_id: r.mentor_id, assigned_date: r.assigned_date || null }))
}
