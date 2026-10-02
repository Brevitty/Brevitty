// VAC Learner workspace data. Email is the join key; VAC_Sessions and VAC_Content are per
// course (+batch), shared by every learner in it. Created + seeded by scripts/setup-hub-pillars-tabs.mjs.
import { allRows, rowsFor, upsert, patchWhere } from './pillarStore.js'
import { fail, istToday, sameEmail, cleanText, cleanLink } from './consulting/rules.js'
import { attendanceSummary, certificateStatus, ASSIGNMENT_DONE, FEEDBACK_AREAS, RATING_MAX } from '../../src/data/vacRules.js'

export const VAC_TABS = {
  VAC_Learners: ['email', 'name', 'roll_no', 'program', 'semester', 'course', 'batch', 'faculty'],
  VAC_Sessions: ['session_id', 'date', 'time', 'title', 'course', 'batch'],
  VAC_Attendance: ['email', 'session_id', 'status'],
  VAC_Content: ['course', 'title', 'format', 'status', 'link'],
  VAC_Assignments: ['assignment_id', 'email', 'title', 'due', 'status', 'link'],
  VAC_Feedback: ['email', 'area', 'rating', 'comment', 'submitted_date'],
}

const MAX_COMMENT = 1000
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

export async function getVac(email) {
  const today = istToday()
  const [[learner], sessionRows, attendanceRows, contentRows, assignmentRows, feedbackRows] = await Promise.all([
    rowsFor('VAC_Learners', email),
    allRows('VAC_Sessions'),
    rowsFor('VAC_Attendance', email),
    allRows('VAC_Content'),
    rowsFor('VAC_Assignments', email),
    rowsFor('VAC_Feedback', email),
  ])
  const sessions = learner
    ? sessionRows
        .filter((s) => s.session_id && same(s.course, learner.course) && (!s.batch || same(s.batch, learner.batch)))
        .map(({ session_id, date, time, title }) => ({ session_id, date, time, title }))
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    : []
  const attendance = Object.fromEntries(attendanceRows.map((a) => [a.session_id, a.status.toLowerCase()]))
  const summary = attendanceSummary(sessions, attendance, today)
  const assignments = assignmentRows
    .map(({ assignment_id, title, due, status, link }) => ({ assignment_id, title, due, status: (status || 'pending').toLowerCase(), link }))
    .sort((a, b) => a.due.localeCompare(b.due))

  return {
    today,
    learner: learner ? { ...learner, email: undefined } : null,
    sessions: sessions.map((s) => ({ ...s, status: attendance[s.session_id] || (s.date < today ? 'absent' : 'upcoming') })),
    summary,
    content: learner ? contentRows.filter((c) => c.title && same(c.course, learner.course)).map(({ title, format, status, link }) => ({ title, format, status, link })) : [],
    assignments,
    feedback: Object.fromEntries(feedbackRows.map((f) => [f.area, { rating: Number(f.rating) || null, comment: f.comment, submittedDate: f.submitted_date }])),
    certificate: certificateStatus(summary, assignments),
    nextClass: sessions.find((s) => s.date >= today) || null,
    nextAssignment: assignments.find((a) => !ASSIGNMENT_DONE.includes(a.status)) || null,
  }
}

export async function submitAssignment(email, body) {
  const id = typeof body.assignment_id === 'string' ? body.assignment_id : ''
  const link = cleanLink(body.link, { required: true })
  const [a] = (await allRows('VAC_Assignments')).filter((r) => r.assignment_id === id && sameEmail(r.email, email))
  if (!a) fail(404, 'Assignment not found.')
  if (a.status.toLowerCase() === 'reviewed') fail(409, 'This assignment has already been reviewed.')
  await patchWhere('VAC_Assignments', { assignment_id: id, email }, { status: 'submitted', link })
  return { assignment_id: id, status: 'submitted', link }
}

export async function submitFeedback(email, body) {
  const area = typeof body.area === 'string' ? body.area : ''
  if (!FEEDBACK_AREAS.some((f) => f.id === area)) fail(400, 'Unknown feedback area.')
  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > RATING_MAX) fail(400, `rating must be 1–${RATING_MAX}.`)
  const comment = cleanText(body.comment, 'comment', { max: MAX_COMMENT })
  const [learner] = await rowsFor('VAC_Learners', email)
  if (!learner) fail(404, 'No VAC enrolment for this account yet.')
  const submittedDate = istToday()
  await upsert('VAC_Feedback', { email, area }, { rating: String(rating), comment, submitted_date: submittedDate })
  return { area, rating, comment, submittedDate }
}
