// VAC Learner: certificate rules. Shared by the client and api/_lib/vacSheet.js.
// Eligibility is always computed from assignments, never hand-set in the sheet.

export const ASSIGNMENT_DONE = ['submitted', 'reviewed']
export const FEEDBACK_AREAS = [
  { id: 'course', label: 'Course experience' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'content', label: 'Content' },
]
export const RATING_MAX = 5

export function certificateStatus(assignments) {
  const done = assignments.filter((a) => ASSIGNMENT_DONE.includes(a.status)).length
  const assignmentsOk = assignments.length > 0 && done === assignments.length
  return { assignmentsOk, eligible: assignmentsOk, done, totalAssignments: assignments.length }
}
