// Launchpad Abroad data (student workspace + mentor view). Email is the join key everywhere.
// Phase/checklist/profile/document DEFINITIONS live in src/data/launchpadChecklist.js; the tabs
// only hold what each student did. Created + seeded by scripts/setup-hub-pillars-tabs.mjs.
import { allRows, rowsFor, upsert, patchWhere, append, newId } from './pillarStore.js'
import { fail, istToday, isDate, isTime, sameEmail, cleanText, cleanLink } from './consulting/rules.js'
import {
  ITEM_IDS, ALL_ITEMS, PROFILE_FIELD_KIND, PROFILE_FIELD_MAX, DOCUMENT_IDS,
  phasesWithStatus, currentPhase, allPhasesDone, profileCompleteness, isProfileReady,
} from '../../src/data/launchpadChecklist.js'

export const LP_TABS = {
  LP_Students: ['email', 'name', 'grade', 'school', 'guardian_name', 'guardian_contact', 'guardian_consent', 'mentor_id'],
  LP_Checklist: ['email', 'item_id', 'checked', 'checked_date'],
  LP_Profile: ['email', 'section', 'field', 'value'],
  LP_Documents: ['email', 'doc_id', 'status', 'submitted_date', 'link'],
  LP_Sessions: ['session_id', 'email', 'mentor_id', 'date', 'time', 'status', 'mom', 'deliverables', 'tasks'],
  LP_Mentors: ['mentor_id', 'name', 'expertise', 'bio', 'contact_email'],
  LP_Signoff: ['email', 'profile_ready', 'signed_by', 'date'],
  LP_Feedback: ['email', 'mentor_id', 'date', 'feedback'],
}

const MAX_SESSION_TEXT = 2000
const MAX_FEEDBACK = 1000
const isTrue = (v) => String(v ?? '').trim().toUpperCase() === 'TRUE'
const byEmail = (rows) => {
  const m = new Map()
  for (const r of rows) {
    const k = r.email.toLowerCase()
    m.set(k, [...(m.get(k) || []), r])
  }
  return (email) => m.get(String(email).toLowerCase()) || []
}

const publicMentor = (m) => m && { mentorId: m.mentor_id, name: m.name, expertise: m.expertise, bio: m.bio, contactEmail: m.contact_email }
const publicStudent = (s) => ({
  email: s.email,
  name: s.name,
  grade: s.grade,
  school: s.school,
  guardian: { name: s.guardian_name, contact: s.guardian_contact, consent: isTrue(s.guardian_consent) },
  mentorId: s.mentor_id,
})
const checkedMap = (rows) => Object.fromEntries(rows.filter((r) => isTrue(r.checked) && ITEM_IDS.has(r.item_id)).map((r) => [r.item_id, true]))
const profileMap = (rows) => Object.fromEntries(rows.map((r) => [`${r.section}.${r.field}`, r.value]))
const signoffOf = ([r]) => (r ? { profileReady: isTrue(r.profile_ready), signedBy: r.signed_by, date: r.date } : null)

function publicSession(r, today, mentorsById) {
  const past = r.status === 'completed' || r.date < today
  return {
    sessionId: r.session_id,
    date: r.date,
    time: r.time,
    status: r.status || 'scheduled',
    past,
    mentor: mentorsById.get(r.mentor_id)?.name || '',
    mom: r.mom,
    deliverables: r.deliverables,
    tasks: r.tasks,
  }
}

// Upcoming soonest-first, then past newest-first.
function sortSessions(list) {
  const up = list.filter((s) => !s.past).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  const past = list.filter((s) => s.past).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
  return [...up, ...past]
}

async function loadAll() {
  const [students, checklist, profile, documents, sessions, mentors, signoff, feedback] = await Promise.all(
    Object.keys(LP_TABS).map((t) => allRows(t))
  )
  return { students, checklist, profile, documents, sessions, mentors, signoff, feedback }
}

// Everything one student's workspace shows. A signed-in account with no LP_Students row gets
// student: null and empty lists (the UI shows a clean empty state).
function workspaceFrom(db, email, { withCommunity = true } = {}) {
  const today = istToday()
  const mentorsById = new Map(db.mentors.map((m) => [m.mentor_id, m]))
  const studentRow = db.students.find((s) => sameEmail(s.email, email))
  const own = (rows) => rows.filter((r) => sameEmail(r.email, email))
  const checked = checkedMap(own(db.checklist))
  const profile = profileMap(own(db.profile))
  const student = studentRow ? publicStudent(studentRow) : null
  const sessions = sortSessions(own(db.sessions).map((r) => publicSession(r, today, mentorsById)))
  const mentor = publicMentor(mentorsById.get(studentRow?.mentor_id) || mentorsById.get(own(db.sessions).at(-1)?.mentor_id))

  const out = {
    today,
    student,
    checked,
    profile,
    documents: own(db.documents)
      .filter((d) => DOCUMENT_IDS.has(d.doc_id))
      .map((d) => ({ docId: d.doc_id, status: d.status || 'pending', submittedDate: d.submitted_date, link: d.link })),
    sessions,
    mentor,
    signoff: signoffOf(own(db.signoff)),
    feedback: own(db.feedback)
      .map((f) => ({ date: f.date, mentor: mentorsById.get(f.mentor_id)?.name || '', feedback: f.feedback }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  }
  if (withCommunity) out.community = communityFrom(db, email)
  return out
}

// Other Launchpad students' startups: first name, grade, school, startup and phase. Nothing else.
function communityFrom(db, email) {
  const checklistOf = byEmail(db.checklist)
  const profileOf = byEmail(db.profile)
  return db.students
    .filter((s) => !sameEmail(s.email, email))
    .map((s) => {
      const p = profileMap(profileOf(s.email))
      const phase = currentPhase(phasesWithStatus(checkedMap(checklistOf(s.email))))
      return {
        firstName: s.name.split(/\s+/)[0],
        grade: s.grade,
        school: s.school,
        startup: p['startup.name'] || '',
        oneLiner: p['startup.one_liner'] || '',
        phase: phase ? phase.label : 'All phases done',
      }
    })
    .filter((c) => c.startup)
}

export async function getLaunchpad(email) {
  const db = await loadAll()
  // isMentor: the student workspace links to the mentor view for accounts that are also mentors.
  return { ...workspaceFrom(db, email), isMentor: db.mentors.some((m) => sameEmail(m.contact_email, email)) }
}

/* ---------------- student writes (always the signed-in email's own rows) ---------------- */

async function requireLpStudent(email) {
  const [row] = await rowsFor('LP_Students', email)
  if (!row) fail(404, 'No Launchpad Abroad record for this account yet.')
  return row
}

export async function setChecklistItem(email, body) {
  const itemId = typeof body.item_id === 'string' ? body.item_id : ''
  if (!ITEM_IDS.has(itemId)) fail(400, 'Unknown checklist item.')
  if (typeof body.checked !== 'boolean') fail(400, 'checked must be true or false.')
  await requireLpStudent(email)
  const checked = checkedMap(await rowsFor('LP_Checklist', email))
  const phaseId = ALL_ITEMS.find((it) => it.id === itemId).phaseId
  if (phasesWithStatus(checked).find((p) => p.id === phaseId).status === 'locked') {
    fail(409, 'Finish the compulsory items of the earlier phase first.')
  }
  await upsert('LP_Checklist', { email, item_id: itemId }, { checked: body.checked ? 'TRUE' : 'FALSE', checked_date: body.checked ? istToday() : '' })
  return { item_id: itemId, checked: body.checked }
}

export async function saveProfileField(email, body) {
  const key = `${body.section}.${body.field}`
  const kind = typeof body.section === 'string' && typeof body.field === 'string' ? PROFILE_FIELD_KIND[key] : undefined
  if (!kind) fail(400, 'Unknown profile field.')
  const value = kind === 'link' ? cleanLink(body.value) : cleanText(body.value, 'value', { max: PROFILE_FIELD_MAX[kind] })
  await requireLpStudent(email)
  await upsert('LP_Profile', { email, section: body.section, field: body.field }, { value })
  return { section: body.section, field: body.field, value }
}

export async function submitDocument(email, body) {
  const docId = typeof body.doc_id === 'string' ? body.doc_id : ''
  if (!DOCUMENT_IDS.has(docId)) fail(400, 'Unknown document.')
  const link = cleanLink(body.link, { required: true })
  await requireLpStudent(email)
  const [existing] = (await rowsFor('LP_Documents', email)).filter((d) => d.doc_id === docId)
  if (existing?.status === 'verified') fail(409, 'This document is already verified by your mentor.')
  const row = await upsert('LP_Documents', { email, doc_id: docId }, { status: 'submitted', submitted_date: istToday(), link })
  return { docId, status: row.status, submittedDate: row.submitted_date, link }
}

export async function updateMySession(email, body) {
  const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
  const changes = {}
  for (const col of ['mom', 'deliverables', 'tasks']) {
    if (body[col] !== undefined) changes[col] = cleanText(body[col], col, { max: MAX_SESSION_TEXT })
  }
  if (!Object.keys(changes).length) fail(400, 'Send mom, deliverables or tasks.')
  const [s] = (await allRows('LP_Sessions')).filter((r) => r.session_id === sessionId && sameEmail(r.email, email))
  if (!s) fail(404, 'Session not found.')
  if (s.status === 'cancelled') fail(409, 'This session was cancelled.')
  if (s.status !== 'completed' && s.date >= istToday()) fail(409, 'You can add notes once the session has happened.')
  await patchWhere('LP_Sessions', { session_id: sessionId, email }, changes)
  return { sessionId, ...changes }
}

/* ---------------- mentor (authorised by LP_Mentors.contact_email) ---------------- */

export async function requireMentor(email) {
  const mentor = (await allRows('LP_Mentors')).find((m) => sameEmail(m.contact_email, email))
  if (!mentor) fail(403, 'This account is not a Launchpad Abroad mentor.')
  return mentor
}

export async function mentorStudents(email) {
  const mentor = await requireMentor(email)
  const db = await loadAll()
  const checklistOf = byEmail(db.checklist)
  const profileOf = byEmail(db.profile)
  const signoffRowsOf = byEmail(db.signoff)
  const docsOf = byEmail(db.documents)
  const students = db.students.filter((s) => !sameEmail(s.email, email)).map((s) => {
    const phases = phasesWithStatus(checkedMap(checklistOf(s.email)))
    const phase = currentPhase(phases)
    return {
      email: s.email,
      name: s.name,
      grade: s.grade,
      school: s.school,
      phase: phase ? phase.label : 'All phases done',
      phaseN: phase ? phase.n : '04',
      completeness: profileCompleteness(profileMap(profileOf(s.email)), s).pct,
      profileReady: isProfileReady(phases, signoffOf(signoffRowsOf(s.email))),
      awaitingVerification: docsOf(s.email).filter((d) => d.status === 'submitted').length,
      mine: s.mentor_id === mentor.mentor_id,
    }
  })
  return { mentor: publicMentor(mentor), students }
}

// The student a mentor action targets. A mentor who is also a student can never act on their own record.
async function requireStudentRow(body, mentorEmail) {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (email && sameEmail(email, mentorEmail)) fail(403, 'Mentors can’t review their own record.')
  const [row] = email ? await rowsFor('LP_Students', email) : []
  if (!row) fail(404, 'Student not found.')
  return row
}

export async function mentorStudentDetail(mentorEmail, query) {
  await requireMentor(mentorEmail)
  const db = await loadAll()
  if (sameEmail(query.email || '', mentorEmail)) fail(403, 'Mentors can’t review their own record.')
  const row = db.students.find((s) => sameEmail(s.email, query.email || ''))
  if (!row) fail(404, 'Student not found.')
  return workspaceFrom(db, row.email, { withCommunity: false })
}

export async function mentorFeedback(mentorEmail, body) {
  const mentor = await requireMentor(mentorEmail)
  const student = await requireStudentRow(body, mentorEmail)
  const feedback = cleanText(body.feedback, 'feedback', { required: true, max: MAX_FEEDBACK })
  await append('LP_Feedback', { email: student.email, mentor_id: mentor.mentor_id, date: istToday(), feedback })
  return { ok: true }
}

export async function mentorSchedule(mentorEmail, body) {
  const mentor = await requireMentor(mentorEmail)
  const student = await requireStudentRow(body, mentorEmail)
  if (!isDate(body.date)) fail(400, 'date must be YYYY-MM-DD.')
  if (!isTime(body.time)) fail(400, 'time must be HH:mm (24h).')
  if (body.date < istToday()) fail(400, 'Pick today or a later date.')
  const clash = (await allRows('LP_Sessions')).some(
    (s) => s.mentor_id === mentor.mentor_id && s.date === body.date && s.time === body.time && s.status !== 'cancelled'
  )
  if (clash) fail(409, 'You already have a session in that slot.')
  const session = { session_id: newId('lps'), email: student.email, mentor_id: mentor.mentor_id, date: body.date, time: body.time, status: 'scheduled' }
  await append('LP_Sessions', session)
  return { sessionId: session.session_id }
}

export async function mentorVerifyDocument(mentorEmail, body) {
  await requireMentor(mentorEmail)
  const student = await requireStudentRow(body, mentorEmail)
  const docId = typeof body.doc_id === 'string' ? body.doc_id : ''
  const [doc] = (await rowsFor('LP_Documents', student.email)).filter((d) => d.doc_id === docId)
  if (!doc || doc.status !== 'submitted' || !doc.link) fail(409, 'Only a submitted document can be verified.')
  await patchWhere('LP_Documents', { email: student.email, doc_id: docId }, { status: 'verified' })
  return { docId, status: 'verified' }
}

export async function mentorSignOff(mentorEmail, body) {
  const mentor = await requireMentor(mentorEmail)
  const student = await requireStudentRow(body, mentorEmail)
  const phases = phasesWithStatus(checkedMap(await rowsFor('LP_Checklist', student.email)))
  if (!allPhasesDone(phases)) fail(409, 'Profile Ready unlocks once Phase 4 (Prove Impact) is complete.')
  await upsert('LP_Signoff', { email: student.email }, { profile_ready: 'TRUE', signed_by: mentor.name, date: istToday() })
  return { profileReady: true }
}
