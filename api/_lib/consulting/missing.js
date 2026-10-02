// The ONE place that decides what is "missing" on a consulting session. Student Home, the
// Sessions badges and sir's Today view all call these, so the two sides can never disagree.
// Pure (no I/O). A session here is a sessions row with `tasks` and `deliverables` arrays attached.
//
//   studentItems(s)  what the STUDENT still owes
//     mom          finished session with no minutes yet (either side can add them)
//     deliverable  a requested deliverable still pending, on a finished session
//     task         an open task whose due date has passed (any live session)
//   sirItems(s)     what SIR still owes, on a finished session
//     mom          no minutes yet
//     tasks        no tasks set and not marked "No tasks for this session"
//     deliverables none requested and not marked "No deliverables"
//
// Cancelled, no-show and removed (archived) sessions never count. "Finished" = the session's end
// time has passed (see inputBlockedReason in rules.js).
import { inputBlockedReason, istToday, isFlag } from './rules.js'

export const isArchived = (s) => isFlag(s.archived)
export const isFinished = (s, now = Date.now()) => !isArchived(s) && inputBlockedReason(s, now) === ''
const isLive = (s) => !isArchived(s) && s.status !== 'cancelled' && s.status !== 'no_show'

export function studentItems(s, now = Date.now()) {
  if (!isLive(s)) return []
  const today = istToday(new Date(now))
  const items = []
  const finished = isFinished(s, now)
  if (finished && !s.mom) items.push({ kind: 'mom', sessionId: s.session_id, label: 'Add the minutes' })
  if (finished) {
    for (const d of s.deliverables ?? []) {
      if (d.status === 'pending') items.push({ kind: 'deliverable', id: d.deliverable_id, sessionId: s.session_id, label: d.title })
    }
  }
  for (const t of s.tasks ?? []) {
    if (t.status === 'open' && t.due_date && t.due_date < today) {
      items.push({ kind: 'task', id: t.task_id, sessionId: s.session_id, label: t.task, overdue: true })
    }
  }
  return items
}

export function sirItems(s, now = Date.now()) {
  if (!isLive(s) || !isFinished(s, now)) return []
  const items = []
  if (!s.mom) items.push({ kind: 'mom', sessionId: s.session_id, label: 'Minutes not added' })
  if (!(s.tasks ?? []).length && !isFlag(s.no_tasks)) items.push({ kind: 'tasks', sessionId: s.session_id, label: 'No tasks set yet' })
  if (!(s.deliverables ?? []).length && !isFlag(s.no_deliverables)) {
    items.push({ kind: 'deliverables', sessionId: s.session_id, label: 'No deliverables set yet' })
  }
  return items
}

// What the student sees as "waiting on sir": his items minus the minutes (those are theirs to add too).
export const waitingOnSir = (s, now) => sirItems(s, now).filter((i) => i.kind !== 'mom')
