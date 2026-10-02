// VAC Learner: certificate rules. Shared by the client and api/_lib/vacSheet.js.
// Eligibility is always computed from attendance + assignments, never hand-set in the sheet.

export const ATTENDANCE_MIN_PCT = 75
export const ASSIGNMENT_DONE = ['submitted', 'reviewed']
export const ASSIGNMENT_STATUSES = ['pending', 'in progress', 'submitted', 'reviewed']
export const FEEDBACK_AREAS = [
  { id: 'course', label: 'Course experience' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'content', label: 'Content' },
]
export const RATING_MAX = 5

// sessions: [{ session_id, date }], attendance: { [session_id]: 'present' | 'absent' }.
// Held = dated before today, or already marked. Rate = present / held so far.
export function attendanceSummary(sessions, attendance, today) {
  const held = sessions.filter((s) => s.date < today || attendance[s.session_id])
  const present = held.filter((s) => attendance[s.session_id] === 'present').length
  return { held: held.length, present, total: sessions.length, pct: held.length ? Math.round((present / held.length) * 100) : null }
}

export function certificateStatus(summary, assignments) {
  const done = assignments.filter((a) => ASSIGNMENT_DONE.includes(a.status)).length
  const attendanceOk = summary.pct !== null && summary.pct >= ATTENDANCE_MIN_PCT
  const assignmentsOk = assignments.length > 0 && done === assignments.length
  return { attendanceOk, assignmentsOk, eligible: attendanceOk && assignmentsOk, done, totalAssignments: assignments.length }
}
