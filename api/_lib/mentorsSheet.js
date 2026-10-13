// Mentors tab reader (full directory, read-only here; edited in Hub Admin > Content). Columns by header name:
// mentor_id | name | expertise | bio | contact_email
import { allRows } from './pillarStore.js'

export async function getMentors() {
  return (await allRows('Mentors'))
    .filter((r) => r.mentor_id)
    .map(({ mentor_id, name, expertise, bio, contact_email }) => ({ mentor_id, name, expertise, bio, contact_email }))
}
