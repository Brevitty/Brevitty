// Admin surface, part 2: sessions, tasks, deliverables. Guarded by auth: 'admin' in the dispatcher.
// Reads go through listReal / findRealOr404: the demo account is invisible here (and never blocks a slot).
import { findRealOr404 as findOr404, listReal as list } from './shared.js'
import { removeFile } from '../../files.js'
import { insert, patch, remove, pub, newId } from '../store.js'
import {
  ApiError, byDateTime, cleanDate, cleanEnum, cleanLink, cleanSessionStatus, cleanText, fail,
  findConflict, FLAG_ON, fromMin, isDate, isFlag, isTime, istToday, sameEmail, slotError, slotToken, toMin,
} from '../rules.js'
import { isArchived } from '../missing.js'
import { TASK_STATUSES, DELIVERABLE_STATUSES } from '../../../../src/data/consultingConstants.js'

const MAX_TEXT_CHARS = 200
const MAX_MOM_CHARS = 20_000 // a Sheets cell holds 50k; leave headroom

const nameOf = (consultees, email) => consultees.find((c) => sameEmail(c.email, email))?.name ?? email
const SLOT_FIELDS = ['date', 'start_time', 'end_time']

/* ---------------- sessions ---------------- */

// Filters: ?date=YYYY-MM-DD (Schedule's taken slots), ?email=, ?status=. Newest first.
async function listSessions({ query }) {
  const [sessions, consultees] = await Promise.all([list('ConsultingSessions'), list('Consultees')])
  return {
    sessions: sessions
      .filter(
        (s) =>
          !isArchived(s) &&
          (!query.date || s.date === query.date) &&
          (!query.email || sameEmail(s.email, query.email)) &&
          (!query.status || s.status === query.status)
      )
      .sort((a, b) => byDateTime(b, a))
      .map((s) => ({ ...pub(s), consultee_name: nameOf(consultees, s.email) })),
  }
}

async function sessionDetail({ query }) {
  const session = await findOr404('ConsultingSessions', query.id, 'Session')
  const [consultee, tasks, deliverables] = await Promise.all([
    findOr404('Consultees', session.email, 'Consultee'),
    list('Tasks'),
    list('Deliverables'),
  ])
  return {
    session: pub(session),
    consultee: pub(consultee),
    tasks: tasks.filter((t) => t.session_id === session.session_id).map(pub),
    deliverables: deliverables.filter((d) => d.session_id === session.session_id).map(pub),
  }
}

// One consultant => one calendar: no two live sessions may overlap, whoever they're with.
async function assertSlotFree(slot, ignoreId) {
  const err = slotError(slot)
  if (err) fail(400, err)
  const clash = findConflict(slot, await list('ConsultingSessions', { fresh: true }), ignoreId)
  if (clash) fail(409, `That slot overlaps another session (${clash.date} ${clash.start_time}–${clash.end_time}).`)
}

async function createSession({ body }) {
  const consultee = await findOr404('Consultees', body.email, 'Consultee')
  // Schedule UI sends start + duration; other callers may send an explicit end_time.
  const end_time =
    body.end_time ?? (Number.isInteger(body.duration_min) && isTime(body.start_time) ? fromMin(toMin(body.start_time) + body.duration_min) : undefined)
  const slot = { date: body.date, start_time: body.start_time, end_time }
  await assertSlotFree(slot, '')
  const row = await insert('ConsultingSessions', {
    session_id: newId('ConsultingSessions'),
    email: consultee.email,
    ...slot,
    topic: cleanText(body.topic, 'topic', { max: MAX_TEXT_CHARS }),
    status: 'scheduled',
    mom: '',
    calendar_event_id: '', // filled by the calendar hook below once it exists
    meet_link: cleanLink(body.meet_link),
    created_at: new Date().toISOString(),
  })
  // ponytail: no calendar invite is sent. To add one, create the Google Calendar event + email invite to row.email here,
  // then patch calendar_event_id (and meet_link if Calendar generates one). Same hook for reschedule/cancel
  // in updateSession.
  return { session: pub(row) }
}

// Partial update: reschedule, status, topic, MoM. The slot is re-checked only when the time
// changes or a cancelled session is revived; editing MoM on a legacy off-grid session still works.
async function updateSession({ body }) {
  const s = await findOr404('ConsultingSessions', body.session_id, 'Session')
  const changes = {}
  if (body.topic !== undefined) changes.topic = cleanText(body.topic, 'topic', { max: MAX_TEXT_CHARS })
  if (body.mom !== undefined) changes.mom = cleanText(body.mom, 'mom', { max: MAX_MOM_CHARS })
  if (body.status !== undefined) changes.status = cleanSessionStatus(body.status)
  // "No tasks / No deliverables for this session": 'TRUE' or ''.
  for (const flag of ['no_tasks', 'no_deliverables']) {
    if (body[flag] === undefined) continue
    if (body[flag] !== FLAG_ON && body[flag] !== '') fail(400, `${flag} must be "${FLAG_ON}" or empty.`)
    changes[flag] = body[flag]
  }
  // Format only, always: a cancelling PATCH skips assertSlotFree, so garbage would otherwise reach the sheet.
  for (const k of SLOT_FIELDS) {
    if (body[k] === undefined) continue
    if (k === 'date' ? !isDate(body[k]) : !isTime(body[k])) fail(400, k === 'date' ? 'date must be YYYY-MM-DD.' : `${k} must be HH:mm (24h).`)
    changes[k] = body[k]
  }

  const next = { ...s, ...changes }
  const moved = SLOT_FIELDS.some((k) => next[k] !== s[k])
  const revived = s.status === 'cancelled' && next.status !== 'cancelled'
  if ((moved || revived) && next.status !== 'cancelled') await assertSlotFree(next, s.session_id)
  // Remember the old slot so the student sees "Rescheduled by sir: old -> new" until they open the session.
  if (moved) Object.assign(changes, { rescheduled_from: slotToken(s), reschedule_seen: '' })
  if (revived) changes.archived = '' // a revived session comes back for both ends
  // A cancelled session disappears from both ends at once (the row stays in the sheet, archived).
  if (next.status === 'cancelled') changes.archived = FLAG_ON
  return { session: pub(await patch('ConsultingSessions', s.session_id, changes, s)) }
}

// Hide a cancelled session for both ends (archived flag; the row stays in the sheet).
async function removeSession({ body }) {
  const s = await findOr404('ConsultingSessions', body.session_id, 'Session')
  if (s.status !== 'cancelled') fail(409, 'Only a cancelled session can be removed.')
  await patch('ConsultingSessions', s.session_id, { archived: FLAG_ON }, s)
  return { ok: true }
}

// A task/deliverable added later means the session is no longer "none needed".
const clearFlag = (session, flag) => (isFlag(session[flag]) ? patch('ConsultingSessions', session.session_id, { [flag]: '' }, session) : null)

// Cross-student tracker: every task and deliverable on a live (not cancelled/archived) session, fresh from the sheet.
async function board() {
  const [sessions, consultees, tasks, deliverables] = await Promise.all([
    list('ConsultingSessions'),
    list('Consultees'),
    list('Tasks'),
    list('Deliverables'),
  ])
  const live = new Map(sessions.filter((s) => !isArchived(s) && s.status !== 'cancelled').map((s) => [s.session_id, s]))
  const decorate = (row) => ({ ...pub(row), consultee_name: nameOf(consultees, row.email), session_topic: live.get(row.session_id).topic })
  const onLive = (row) => live.has(row.session_id)
  return { today: istToday(), tasks: tasks.filter(onLive).map(decorate), deliverables: deliverables.filter(onLive).map(decorate) }
}

/* ---------------- tasks ---------------- */

async function createTask({ body }) {
  const session = await findOr404('ConsultingSessions', body.session_id, 'Session')
  const row = await insert('Tasks', {
    task_id: newId('Tasks'),
    session_id: session.session_id,
    email: session.email,
    task: cleanText(body.task, 'task', { required: true, max: MAX_TEXT_CHARS }),
    due_date: cleanDate(body.due_date, 'due_date'),
    status: 'open',
    completed_date: '',
  })
  await clearFlag(session, 'no_tasks')
  return { task: pub(row) }
}

async function updateTask({ body }) {
  const t = await findOr404('Tasks', body.task_id, 'Task')
  const changes = {}
  if (body.task !== undefined) changes.task = cleanText(body.task, 'task', { required: true, max: MAX_TEXT_CHARS })
  if (body.due_date !== undefined) changes.due_date = cleanDate(body.due_date, 'due_date')
  if (body.status !== undefined) {
    changes.status = cleanEnum(body.status, TASK_STATUSES, 'status')
    changes.completed_date = changes.status === 'done' ? t.completed_date || istToday() : ''
  }
  return { task: pub(await patch('Tasks', t.task_id, changes)) }
}

/* ---------------- deliverables ---------------- */

// Sir requests a deliverable (title + status); the student uploads the file against it.
async function createDeliverable({ body }) {
  const session = await findOr404('ConsultingSessions', body.session_id, 'Session')
  const link = ''
  const status = body.status === undefined ? 'pending' : cleanEnum(body.status, DELIVERABLE_STATUSES, 'status')
  const row = await insert('Deliverables', {
    deliverable_id: newId('Deliverables'),
    session_id: session.session_id,
    email: session.email,
    title: cleanText(body.title, 'title', { required: true, max: MAX_TEXT_CHARS }),
    link,
    status,
    submitted_date: status === 'pending' ? '' : istToday(),
  })
  await clearFlag(session, 'no_deliverables')
  return { deliverable: pub(row) }
}

async function updateDeliverable({ body }) {
  const d = await findOr404('Deliverables', body.deliverable_id, 'Deliverable')
  const changes = {}
  if (body.title !== undefined) changes.title = cleanText(body.title, 'title', { required: true, max: MAX_TEXT_CHARS })
  if (body.status !== undefined) {
    changes.status = cleanEnum(body.status, DELIVERABLE_STATUSES, 'status')
    if (changes.status !== 'pending' && !d.submitted_date) changes.submitted_date = istToday()
  }
  return { deliverable: pub(await patch('Deliverables', d.deliverable_id, changes)) }
}

/* ---------------- delete (by ?id=) ---------------- */

const deleter = (tab, label) => async ({ query }) => {
  const row = await findOr404(tab, query.id, label)
  if (!(await remove(tab, query.id))) throw new ApiError(404, `${label} not found.`)
  await removeFile(row.link) // a deleted deliverable takes its uploaded file with it
  return { ok: true }
}

export default {
  'GET admin/sessions': { auth: 'admin', fn: listSessions },
  'GET admin/session': { auth: 'admin', fn: sessionDetail },
  'POST admin/sessions': { auth: 'admin', fn: createSession, status: 201 },
  'PATCH admin/sessions': { auth: 'admin', fn: updateSession },
  'POST admin/sessions/remove': { auth: 'admin', fn: removeSession },
  'GET admin/board': { auth: 'admin', fn: board },
  'POST admin/tasks':{ auth: 'admin', fn: createTask, status: 201 },
  'PATCH admin/tasks': { auth: 'admin', fn: updateTask },
  'DELETE admin/tasks': { auth: 'admin', fn: deleter('Tasks', 'Task') },
  'POST admin/deliverables': { auth: 'admin', fn: createDeliverable, status: 201 },
  'PATCH admin/deliverables': { auth: 'admin', fn: updateDeliverable },
  'DELETE admin/deliverables': { auth: 'admin', fn: deleter('Deliverables', 'Deliverable') },
}
