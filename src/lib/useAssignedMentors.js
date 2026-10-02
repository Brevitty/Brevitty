import { useJunctionFetch } from './useJunctionFetch.js'

// Joins the full Mentors directory against the student's own MentorAssignments
// rows — used by both MentorsView and OverviewView's mentor card.
export function useAssignedMentors(onUnauthorized) {
  const directory = useJunctionFetch('/api/hub/mentors', onUnauthorized)
  const assignments = useJunctionFetch('/api/hub/mentor-assignments', onUnauthorized)

  const loading = directory.loading || assignments.loading
  const error = directory.error || assignments.error
  let mentors = []
  if (directory.data && assignments.data) {
    const assignedIds = new Set(assignments.data.assignments.map((a) => a.mentor_id))
    mentors = directory.data.mentors.filter((m) => assignedIds.has(m.mentor_id))
  }

  return { loading, error, mentors }
}
