// Student Consultancy workspace. One API call (GET sessions, with tasks and
// deliverables nested) feeds every view; saves patch that data in place with the
// row the server returns, so what's shown is always what landed in the sheet.
import { useCallback } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import ConsultingShell from '../ConsultingShell.jsx'
import { LoadingState, ErrorState } from '../ui.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import {
  getMySessions, saveMyMom, updateMyTask, addMyDeliverable, submitMyDeliverable, markSessionSeen, setSessionFlags, removeMySession,
} from '../../../lib/consultingApi.js'
import { GridIcon, CalendarIcon, CalendarCheckIcon, FileIcon } from '../../junction/dashboard/icons.jsx'
import OverviewView from './OverviewView.jsx'
import SessionsView from './SessionsView.jsx'
import SessionPage from './SessionPage.jsx'
import TasksView from './TasksView.jsx'
import DeliverablesView from './DeliverablesView.jsx'

const NAV = [
  { to: '/consulting', end: true, label: 'Home', icon: GridIcon },
  { to: '/consulting/sessions', label: 'Sessions', icon: CalendarIcon },
  { to: '/consulting/tasks', label: 'Tasks', icon: CalendarCheckIcon },
  { to: '/consulting/deliverables', label: 'Deliverables', icon: FileIcon },
]

export default function StudentApp({ account, onSignOut }) {
  const { loading, error, data, reload, setData } = useLoad(getMySessions, [])

  const mapSession = useCallback(
    (sessionId, fn) => setData((d) => ({ ...d, sessions: d.sessions.map((s) => (s.session_id === sessionId ? fn(s) : s)) })),
    [setData]
  )
  const replaceTask = useCallback(
    (t) => mapSession(t.session_id, (s) => ({ ...s, tasks: s.tasks.map((x) => (x.task_id === t.task_id ? t : x)) })),
    [mapSession]
  )
  const replaceDeliverable = useCallback(
    (d) => mapSession(d.session_id, (s) => ({ ...s, deliverables: s.deliverables.map((x) => (x.deliverable_id === d.deliverable_id ? d : x)) })),
    [mapSession]
  )

  const saveMom = useCallback(
    async (session, mom, momLink) => {
      const { session: saved } = await saveMyMom(session.session_id, mom, momLink)
      mapSession(session.session_id, (s) => ({ ...s, ...saved }))
    },
    [mapSession]
  )

  const mergeSession = useCallback((saved) => mapSession(saved.session_id, (s) => ({ ...s, ...saved })), [mapSession])
  const markSeen = useCallback(async (session) => mergeSession((await markSessionSeen(session.session_id)).session), [mergeSession])
  const setFlags = useCallback(async (session, flags) => mergeSession((await setSessionFlags(session.session_id, flags)).session), [mergeSession])
  const removeSession = useCallback(
    async (session) => {
      await removeMySession(session.session_id)
      setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.session_id !== session.session_id) }))
    },
    [setData]
  )

  // Waits for the server (the session page shows its own spinner and "Saved").
  const updateTask = useCallback(
    async (task, changes) => {
      const { task: saved } = await updateMyTask(task.task_id, changes)
      replaceTask(saved)
    },
    [replaceTask]
  )

  // Optimistic tick for the list views: flip locally, then reconcile with the server row (or roll back).
  const toggleTask = useCallback(
    async (task) => {
      replaceTask({ ...task, status: task.status === 'done' ? 'open' : 'done' })
      try {
        await updateTask(task, { status: task.status === 'done' ? 'open' : 'done' })
      } catch (err) {
        replaceTask(task)
        throw err
      }
    },
    [replaceTask, updateTask]
  )

  const submitDeliverable = useCallback(
    async (d, link, note) => {
      const { deliverable } = await submitMyDeliverable(d.deliverable_id, link, note)
      replaceDeliverable(deliverable)
    },
    [replaceDeliverable]
  )

  const addDeliverable = useCallback(
    async (sessionId, title, link) => {
      const { deliverable } = await addMyDeliverable(sessionId, title, link)
      mapSession(sessionId, (s) => ({ ...s, deliverables: [...s.deliverables, deliverable] }))
    },
    [mapSession]
  )

  let body
  if (loading) body = <LoadingState />
  else if (error && !data) body = <ErrorState message={error} onRetry={reload} />
  else {
    const props = { account, sessions: data.sessions, toggleTask, updateTask, saveMom, submitDeliverable, addDeliverable, markSeen, setFlags, removeSession }
    body = (
      <Routes>
        <Route index element={<OverviewView {...props} />} />
        <Route path="sessions" element={<SessionsView {...props} />} />
        <Route path="sessions/:id" element={<SessionPage {...props} />} />
        <Route path="tasks" element={<TasksView {...props} />} />
        <Route path="deliverables" element={<DeliverablesView {...props} />} />
        <Route path="*" element={<Navigate to="/consulting" replace />} />
      </Routes>
    )
  }

  return (
    <ConsultingShell surface="Student" nav={NAV} account={account} onSignOut={onSignOut}>
      {body}
    </ConsultingShell>
  )
}
