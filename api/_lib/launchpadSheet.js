// Launchpad Abroad data (student workspace + Hub Admin staff review). Email is the join key everywhere.
// Phase/checklist/profile/document DEFINITIONS live in src/data/launchpadChecklist.js; the tabs
// only hold what each student did. Created + seeded by scripts/setup-sheets.js.
import { allRows, rowsFor, upsert, patchWhere, append, newId, warm } from './pillarStore.js'
import { fail, istToday, isDate, isTime, sameEmail, cleanText, cleanLink } from './consulting/rules.js'
import { checkUploaded, removeFile } from './files.js'
import { isDemoEmail } from './accounts.js'
import {
  ITEM_IDS, ALL_ITEMS, PROFILE_FIELD_KIND, PROFILE_FIELD_MAX, DOCUMENT_IDS,
  phasesWithStatus, currentPhase, allPhasesDone, profileCompleteness, isProfileReady,
} from '../../src/data/launchpadChecklist.js'

export const LP_TABS = {
  LP_Students: ['email', 'name', 'grade', 'school', 'guardian_name', 'guardian_contact', 'guardian_consent'],
  LP_Checklist: ['email', 'item_id', 'checked', 'checked_date'],
  LP_Profile: ['email', 'section', 'field', 'value'],
  LP_Documents: ['email', 'doc_id', 'status', 'submitted_date', 'link'],
  LP_Sessions: ['session_id', 'email', 'date', 'time', 'status', 'mom', 'deliverables', 'tasks'],
  LP_Signoff: ['email', 'profile_ready', 'signed_by', 'date'],
  LP_Feedback: ['email', 'date', 'feedback'],
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

const publicStudent = (s) => ({
  email: s.email,
  name: s.name,
  grade: s.grade,
  school: s.school,
  guardian: { name: s.guardian_name, contact: s.guardian_contact, consent: isTrue(s.guardian_consent) },
})
const checkedMap = (rows) => Object.fromEntries(rows.filter((r) => isTrue(r.checked) && ITEM_IDS.has(r.item_id)).map((r) => [r.item_id, true]))
const profileMap = (rows) => Object.fromEntries(rows.map((r) => [`${r.section}.${r.field}`, r.value]))
const signoffOf = ([r]) => (r ? { profileReady: isTrue(r.profile_ready), signedBy: r.signed_by, date: r.date } : null)

function publicSession(r, today) {
  const past = r.status === 'completed' || r.date < today
  return {
    sessionId: r.session_id,
    date: r.date,
    time: r.time,
    status: r.status || 'scheduled',
    past,
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
  await warm(Object.keys(LP_TABS))
  const [students, checklist, profile, documents, sessions, signoff, feedback] = await Promise.all(
    Object.keys(LP_TABS).map((t) => allRows(t))
  )
  return { students, checklist, profile, documents, sessions, signoff, feedback }
}

// Everything one student's workspace shows. A signed-in account with no LP_Students row gets
// student: null and empty lists (the UI shows a clean empty state).
function workspaceFrom(db, email, { withCommunity = true } = {}) {
  const today = istToday()
  const studentRow = db.students.find((s) => sameEmail(s.email, email))
  const own = (rows) => rows.filter((r) => sameEmail(r.email, email))
  const checked = checkedMap(own(db.checklist))
  const profile = profileMap(own(db.profile))
  const student = studentRow ? publicStudent(studentRow) : null
  const sessions = sortSessions(own(db.sessions).map((r) => publicSession(r, today)))

  const out = {
    today,
    student,
    checked,
    profile,
    documents: own(db.documents)
      .filter((d) => DOCUMENT_IDS.has(d.doc_id))
      .map((d) => ({ docId: d.doc_id, status: d.status || 'pending', submittedDate: d.submitted_date, link: d.link })),
    sessions,
    signoff: signoffOf(own(db.signoff)),
    feedback: own(db.feedback)
      .map((f) => ({ date: f.date, feedback: f.feedback }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  }
  if (withCommunity) out.community = communityFrom(db, email)
  return out
}

// Other Launchpad students' startups: first name, grade, school, startup and phase. Nothing else.
// The demo account never shows up in a real student's community.
function communityFrom(db, email) {
  const checklistOf = byEmail(db.checklist)
  const profileOf = byEmail(db.profile)
  return db.students
    .filter((s) => !sameEmail(s.email, email) && !isDemoEmail(s.email))
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
  return workspaceFrom(db, email)
}

/* ---------------- student writes (always the signed-in email's own rows) ---------------- */

async function requireLpStudent(email) {
  const [row] = await rowsFor('LP_Students', email)
  if (!row) fail(404, 'No Launchpad Abroad record for this account yet.')
  return row
}

// A newly approved student creates their own record.
// body: { name, grade, school, guardian_name, guardian_contact?, guardian_consent: boolean }
export async function setupStudent(email, body) {
  if ((await rowsFor('LP_Students', email)).length) fail(409, 'Your Launchpad record already exists.')
  if (body.guardian_consent !== true) fail(400, 'A parent or guardian must consent before you start.')
  await append('LP_Students', {
    email,
    name: cleanText(body.name, 'Name', { required: true, max: 120 }),
    grade: cleanText(body.grade, 'Grade', { required: true, max: 10 }),
    school: cleanText(body.school, 'School', { required: true, max: 200 }),
    guardian_name: cleanText(body.guardian_name, 'Guardian name', { required: true, max: 120 }),
    guardian_contact: cleanText(body.guardian_contact, 'Guardian contact', { max: 120 }),
    guardian_consent: 'TRUE',
  })
  return getLaunchpad(email)
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

// body: { doc_id, file_path } (uploaded first via /api/files/upload-url). `link` holds the storage path.
export async function submitDocument(email, body) {
  const docId = typeof body.doc_id === 'string' ? body.doc_id : ''
  if (!DOCUMENT_IDS.has(docId)) fail(400, 'Unknown document.')
  await requireLpStudent(email)
  const [existing] = (await rowsFor('LP_Documents', email)).filter((d) => d.doc_id === docId)
  if (existing?.status === 'verified') fail(409, 'This document is already verified by the Launchpad team.')
  const link = await checkUploaded(email, 'launchpad', body.file_path)
  const row = await upsert('LP_Documents', { email, doc_id: docId }, { status: 'submitted', submitted_date: istToday(), link })
  if (existing?.link !== link) await removeFile(existing?.link)
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

/* ---------------- staff review (Hub Admin only: the route layer checks the admin membership) ---------------- */

// Each Launchpad student's computed progress (phase, profile completeness, sign-off, documents waiting).
// Pure over the loaded tabs: shared by the staff list and the Hub Admin dashboards.
export function progressRows(db) {
  const checklistOf = byEmail(db.checklist)
  const profileOf = byEmail(db.profile)
  const signoffRowsOf = byEmail(db.signoff)
  const docsOf = byEmail(db.documents)
  return db.students.map((s) => {
    const phases = phasesWithStatus(checkedMap(checklistOf(s.email)))
    const phase = currentPhase(phases)
    return {
      email: s.email,
      name: s.name,
      grade: s.grade,
      school: s.school,
      phase: phase ? phase.label : 'All phases done',
      phaseN: phase ? phase.n : '04',
      phasesDone: phases.filter((p) => p.status === 'done').length,
      completeness: profileCompleteness(profileMap(profileOf(s.email)), s).pct,
      profileReady: isProfileReady(phases, signoffOf(signoffRowsOf(s.email))),
      awaitingVerification: docsOf(s.email).filter((d) => d.status === 'submitted').length,
      lastActivity: checklistOf(s.email).filter((r) => isTrue(r.checked)).map((r) => r.checked_date).sort().at(-1) || '',
    }
  })
}

export async function launchpadStudents() {
  const db = await loadAll()
  const students = progressRows(db)
    .filter((s) => !isDemoEmail(s.email)) // staff see real students only
    .map(({ email, name, grade, school, phase, phaseN, completeness, profileReady, awaitingVerification }) => ({
      email, name, grade, school, phase, phaseN, completeness, profileReady, awaitingVerification,
    }))
  return { students }
}

async function requireStudentRow(body) {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const [row] = email && !isDemoEmail(email) ? await rowsFor('LP_Students', email) : []
  if (!row) fail(404, 'Student not found.')
  return row
}

export async function launchpadStudentDetail(query) {
  const db = await loadAll()
  const row = db.students.find((s) => sameEmail(s.email, query.email || '') && !isDemoEmail(s.email))
  if (!row) fail(404, 'Student not found.')
  return workspaceFrom(db, row.email, { withCommunity: false })
}

export async function staffFeedback(body) {
  const student = await requireStudentRow(body)
  const feedback = cleanText(body.feedback, 'feedback', { required: true, max: MAX_FEEDBACK })
  await append('LP_Feedback', { email: student.email, date: istToday(), feedback })
  return { ok: true }
}

export async function staffSchedule(body) {
  const student = await requireStudentRow(body)
  if (!isDate(body.date)) fail(400, 'date must be YYYY-MM-DD.')
  if (!isTime(body.time)) fail(400, 'time must be HH:mm (24h).')
  if (body.date < istToday()) fail(400, 'Pick today or a later date.')
  const clash = (await rowsFor('LP_Sessions', student.email)).some((s) => s.date === body.date && s.time === body.time && s.status !== 'cancelled')
  if (clash) fail(409, 'This student already has a session in that slot.')
  const session = { session_id: newId('lps'), email: student.email, date: body.date, time: body.time, status: 'scheduled' }
  await append('LP_Sessions', session)
  return { sessionId: session.session_id }
}

export async function staffVerifyDocument(body) {
  const student = await requireStudentRow(body)
  const docId = typeof body.doc_id === 'string' ? body.doc_id : ''
  const [doc] = (await rowsFor('LP_Documents', student.email)).filter((d) => d.doc_id === docId)
  if (!doc || doc.status !== 'submitted' || !doc.link) fail(409, 'Only a submitted document can be verified.')
  await patchWhere('LP_Documents', { email: student.email, doc_id: docId }, { status: 'verified' })
  return { docId, status: 'verified' }
}

export async function staffSignOff(adminName, body) {
  const student = await requireStudentRow(body)
  const phases = phasesWithStatus(checkedMap(await rowsFor('LP_Checklist', student.email)))
  if (!allPhasesDone(phases)) fail(409, 'Profile Ready unlocks once Phase 4 (Prove Impact) is complete.')
  await upsert('LP_Signoff', { email: student.email }, { profile_ready: 'TRUE', signed_by: adminName || 'Launchpad team', date: istToday() })
  return { profileReady: true }
}
