// Student surface. The email always comes from the session (`account`), never from the request.
// Every write is to the student's own rows (findOr404 with ownedBy -> 404 otherwise), and minutes
// and deliverables only once the session is over (inputBlockedReason). Task updates are allowed
// any time: prep tasks can be set on an upcoming session. Only sir can change a session's time.
import { findOr404 } from './shared.js'
import { list, patch, pub } from '../store.js'
import { checkUploaded, removeFile } from '../../files.js'
import {
  byDateTime, cleanEnum, cleanText, fail, FLAG_ON, inputBlockedReason, isFlag, istToday, sameEmail,
} from '../rules.js'
import { isArchived } from '../missing.js'
import { TASK_STATUSES } from '../../../../src/data/consultingConstants.js'

const MAX_MOM_CHARS = 20_000 // a Sheets cell holds 50k; leave headroom
const MAX_NOTE_CHARS = 500
const SIR_ONLY_FIELDS = ['date', 'start_time', 'end_time', 'status', 'topic']

// The student never needs the calendar bookkeeping column.
const studentSession = ({ calendar_event_id, ...s }) => s

async function mySessions({ account }) {
  const [sessions, tasks, deliverables] = await Promise.all([list('ConsultingSessions'), list('Tasks'), list('Deliverables')])
  const mine = (row) => sameEmail(row.email, account.email)
  return {
    sessions: sessions
      .filter((s) => mine(s) && !isArchived(s)) // removed sessions are hidden from both ends
      .sort(byDateTime)
      .map((s) => ({
        ...studentSession(pub(s)),
        tasks: tasks.filter((t) => mine(t) && t.session_id === s.session_id).map(pub),
        deliverables: deliverables.filter((d) => mine(d) && d.session_id === s.session_id).map(pub),
      })),
  }
}

// Time, status and topic belong to sir. Refuse loudly instead of silently ignoring them.
function refuseSirFields(body) {
  if (SIR_ONLY_FIELDS.some((k) => body[k] !== undefined)) fail(403, 'Only your consultant can change a session’s time or status.')
}

async function ownSession(account, sessionId) {
  const session = await findOr404('ConsultingSessions', sessionId, 'Session', { ownedBy: account.email })
  if (isArchived(session)) fail(404, 'Session not found.')
  return session
}

async function ownSessionOpenForInput(account, sessionId) {
  const session = await ownSession(account, sessionId)
  const blocked = inputBlockedReason(session)
  if (blocked) fail(409, blocked)
  return session
}

// Minutes of meeting: one text box plus an optional attachment (`mom_link` holds its storage path).
// body.mom_file: undefined keeps the current attachment, '' removes it, a path replaces it.
async function saveMom({ account, body }) {
  refuseSirFields(body)
  const session = await ownSessionOpenForInput(account, body.session_id)
  const changes = {
    mom: cleanText(body.mom, 'Minutes', { required: true, max: MAX_MOM_CHARS }),
    mom_submitted_at: new Date().toISOString(),
  }
  if (body.mom_file !== undefined) changes.mom_link = await checkUploaded(account.email, 'consulting', body.mom_file, { required: false })
  const saved = await patch('ConsultingSessions', session.session_id, changes, session)
  if (changes.mom_link !== undefined && changes.mom_link !== session.mom_link) await removeFile(session.mom_link)
  return { session: studentSession(pub(saved)) }
}

// The student opened the session: the "Rescheduled by sir" notice has been seen.
async function markSeen({ account, body }) {
  const session = await ownSession(account, body.session_id)
  if (!session.rescheduled_from || isFlag(session.reschedule_seen)) return { session: studentSession(pub(session)) }
  return { session: studentSession(pub(await patch('ConsultingSessions', session.session_id, { reschedule_seen: FLAG_ON }, session))) }
}

// "No tasks / No deliverables for this session" on or off. Either side can flip it; adding a
// task or deliverable later clears it (see adminSessions.js / addDeliverable below).
async function setFlags({ account, body }) {
  refuseSirFields(body)
  const session = await ownSession(account, body.session_id)
  if (session.status === 'cancelled') fail(409, 'This session was cancelled.')
  const changes = {}
  for (const [flag, tab, what] of [['no_tasks', 'Tasks', 'tasks'], ['no_deliverables', 'Deliverables', 'deliverables']]) {
    if (body[flag] === undefined) continue
    if (typeof body[flag] !== 'boolean') fail(400, `${flag} must be true or false.`)
    if (body[flag]) {
      const rows = await list(tab, { fresh: true })
      if (rows.some((r) => r.session_id === session.session_id)) fail(409, `This session already has ${what}.`)
    }
    changes[flag] = body[flag] ? FLAG_ON : ''
  }
  if (!Object.keys(changes).length) fail(400, 'Send no_tasks and/or no_deliverables.')
  return { session: studentSession(pub(await patch('ConsultingSessions', session.session_id, changes, session))) }
}

// Hide a cancelled session for both ends (archived flag; the row stays in the sheet).
async function removeSession({ account, body }) {
  const session = await ownSession(account, body.session_id)
  if (session.status !== 'cancelled') fail(409, 'Only a cancelled session can be removed.')
  await patch('ConsultingSessions', session.session_id, { archived: FLAG_ON }, session)
  return { ok: true }
}

// Ticks/reopens and/or a short note. Marking done stamps completed_date (kept if it was already done).
async function updateTask({ account, body }) {
  const task = await findOr404('Tasks', body.task_id, 'Task', { ownedBy: account.email })
  const changes = {}
  if (body.status !== undefined) {
    changes.status = cleanEnum(body.status, TASK_STATUSES, 'status')
    changes.completed_date = changes.status === 'done' ? (task.status === 'done' && task.completed_date) || istToday() : ''
  }
  if (body.note !== undefined) changes.note = cleanText(body.note, 'Note', { max: MAX_NOTE_CHARS })
  if (!Object.keys(changes).length) fail(400, 'Send a status and/or a note.')
  return { task: pub(await patch('Tasks', task.task_id, changes, task)) }
}

// Submit (or replace) the file on a deliverable sir requested, with an optional note. Reviewed ones are locked.
// A replaced file's old object is deleted.
async function submitDeliverable({ account, body }) {
  const d = await findOr404('Deliverables', body.deliverable_id, 'Deliverable', { ownedBy: account.email })
  if (d.status === 'reviewed') fail(409, 'This deliverable has already been reviewed.')
  await ownSessionOpenForInput(account, d.session_id)
  // No new file + an existing one = a note-only update.
  const keepFile = (body.file_path === undefined || body.file_path === '') && d.link
  const changes = {
    link: keepFile ? d.link : await checkUploaded(account.email, 'consulting', body.file_path),
    status: 'submitted',
    submitted_date: keepFile && d.submitted_date ? d.submitted_date : istToday(),
  }
  if (body.note !== undefined) changes.note = cleanText(body.note, 'Note', { max: MAX_NOTE_CHARS })
  const saved = await patch('Deliverables', d.deliverable_id, changes, d)
  if (d.link !== changes.link) await removeFile(d.link)
  return { deliverable: pub(saved) }
}

export default {
  'GET sessions': { auth: 'student', fn: mySessions },
  'PATCH sessions': { auth: 'student', fn: saveMom },
  'POST sessions/seen': { auth: 'student', fn: markSeen },
  'PATCH sessions/flags': { auth: 'student', fn: setFlags },
  'POST sessions/remove': { auth: 'student', fn: removeSession },
  'PATCH tasks': { auth: 'student', fn: updateTask },
  'PATCH deliverables': { auth: 'student', fn: submitDeliverable },
}
