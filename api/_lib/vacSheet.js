// VAC Learner workspace data. Email is the join key; VAC_Sessions and VAC_Content are per
// course (+batch), shared by every learner in it. Created + seeded by scripts/setup-hub-pillars-tabs.mjs.
import { allRows, rowsFor, upsert, patchWhere, append, warm } from './pillarStore.js'
import { fail, istToday, sameEmail, cleanText } from './consulting/rules.js'
import { checkUploaded, removeFile } from './files.js'
import { isDemoEmail, DEMO_VAC_BATCH } from './accounts.js'
import { certificateStatus, ASSIGNMENT_DONE, FEEDBACK_AREAS, RATING_MAX } from '../../src/data/vacRules.js'

export const VAC_TABS = {
  VAC_Learners: ['email', 'name', 'roll_no', 'program', 'semester', 'course', 'batch', 'faculty'],
  VAC_Sessions: ['session_id', 'date', 'time', 'title', 'course', 'batch'],
  VAC_Content: ['course', 'title', 'format', 'status', 'link'],
  VAC_Assignments: ['assignment_id', 'email', 'title', 'due', 'status', 'link'],
  VAC_Feedback: ['email', 'area', 'rating', 'comment', 'submitted_date'],
}

const MAX_COMMENT = 1000
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

export async function getVac(email) {
  const today = istToday()
  await warm(Object.keys(VAC_TABS))
  const [[learner], sessionRows, contentRows, assignmentRows, feedbackRows] = await Promise.all([
    rowsFor('VAC_Learners', email),
    allRows('VAC_Sessions'),
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
  const assignments = assignmentRows
    .map(({ assignment_id, title, due, status, link }) => ({ assignment_id, title, due, status: (status || 'pending').toLowerCase(), link }))
    .sort((a, b) => a.due.localeCompare(b.due))

  return {
    today,
    learner: learner ? { ...learner, email: undefined } : null,
    sessions: sessions.map((s) => ({ ...s, status: s.date < today ? 'past' : 'upcoming' })),
    content: learner ? contentRows.filter((c) => c.title && same(c.course, learner.course)).map(({ title, format, status, link }) => ({ title, format, status, link })) : [],
    assignments,
    feedback: Object.fromEntries(feedbackRows.map((f) => [f.area, { rating: Number(f.rating) || null, comment: f.comment, submittedDate: f.submitted_date }])),
    certificate: certificateStatus(assignments),
    nextClass: sessions.find((s) => s.date >= today) || null,
    nextAssignment: assignments.find((a) => !ASSIGNMENT_DONE.includes(a.status)) || null,
    courses: learner ? [] : openCourses(sessionRows, email),
  }
}

// body: { assignment_id, file_path } (uploaded first via /api/files/upload-url). `link` holds the storage path.
// Courses (and batches) that have classes scheduled: what a new learner can enrol in.
function openCourses(sessionRows, email) {
  const map = new Map()
  for (const s of sessionRows) {
    if (!s.session_id || !s.course || (s.batch === DEMO_VAC_BATCH && !isDemoEmail(email))) continue
    const c = map.get(s.course) || new Set()
    if (s.batch) c.add(s.batch)
    map.set(s.course, c)
  }
  return [...map].map(([course, batches]) => ({ course, batches: [...batches].sort() })).sort((a, b) => a.course.localeCompare(b.course))
}

// A newly approved learner enrols in a course that has classes. body: { name, roll_no, program, semester, course, batch? }
export async function enroll(email, body) {
  if ((await rowsFor('VAC_Learners', email)).length) fail(409, 'You are already enrolled.')
  const course = openCourses(await allRows('VAC_Sessions'), email).find((c) => c.course === body.course)
  if (!course) fail(400, 'Choose one of the open courses.')
  const batch = course.batches.length ? (course.batches.includes(body.batch) ? body.batch : fail(400, 'Choose your batch.')) : ''
  await append('VAC_Learners', {
    email,
    name: cleanText(body.name, 'Name', { required: true, max: 120 }),
    roll_no: cleanText(body.roll_no, 'Roll number', { required: true, max: 40 }),
    program: cleanText(body.program, 'Program', { max: 120 }),
    semester: cleanText(body.semester, 'Semester', { max: 10 }),
    course: course.course,
    batch,
    faculty: '',
  })
  return getVac(email)
}

export async function submitAssignment(email, body) {
  const id = typeof body.assignment_id === 'string' ? body.assignment_id : ''
  const [a] = (await allRows('VAC_Assignments')).filter((r) => r.assignment_id === id && sameEmail(r.email, email))
  if (!a) fail(404, 'Assignment not found.')
  if (a.status.toLowerCase() === 'reviewed') fail(409, 'This assignment has already been reviewed.')
  const link = await checkUploaded(email, 'vac', body.file_path)
  await patchWhere('VAC_Assignments', { assignment_id: id, email }, { status: 'submitted', link })
  if (a.link !== link) await removeFile(a.link)
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
