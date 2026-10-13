// Cross-student tracker: every task and deliverable in one place, with quick tick-off.
// Reads fresh from the sheet on every visit; a tick writes straight to the Tasks/Deliverables tab.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Card, Tabs, Button, StatusPill, InlineError, EmptyState, Loaded, inputClass, viewItem, labelClass } from '../ui.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import { admin } from '../../../lib/consultingApi.js'
import { fmtDate, daysFromToday } from '../../../lib/consultingTime.js'
import { paths } from './paths.js'
import { FileLink } from '../../hub/FileUpload.jsx'

const TABS = ['tasks', 'deliverables']
const TASK_FILTERS = [
  ['open', 'Open'],
  ['overdue', 'Overdue'],
  ['done', 'Done'],
  ['all', 'All'],
]
const DELIVERABLE_FILTERS = [
  ['waiting', 'Waiting on student'],
  ['submitted', 'To review'],
  ['reviewed', 'Reviewed'],
  ['all', 'All'],
]
const byDue = (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')

function Row({ to, check, title, meta, right }) {
  return (
    <div className="flex items-start gap-4 border-b border-black/[0.06] px-5 py-4 last:border-0">
      {check}
      <Link to={to} className="min-w-0 flex-1 hover:underline">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-black/45">{meta}</span>
      </Link>
      {right}
    </div>
  )
}

function TaskRow({ t, today, onToggle }) {
  const overdue = t.status === 'open' && t.due_date && t.due_date < today
  return (
    <Row
      to={paths.session(t.session_id)}
      check={
        <input
          type="checkbox"
          aria-label={`Mark "${t.task}" ${t.status === 'done' ? 'open' : 'done'}`}
          checked={t.status === 'done'}
          onChange={() => onToggle(t)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#f97316]"
        />
      }
      title={<span className={t.status === 'done' ? 'text-black/40 line-through' : ''}>{t.task}</span>}
      meta={`${t.consultee_name} · ${t.session_topic || 'Session'}`}
      right={
        t.due_date ? (
          <span className={`shrink-0 text-right font-mono text-[11px] ${overdue ? 'font-semibold text-red-600' : 'text-black/50'}`}>
            {overdue ? `${-daysFromToday(t.due_date)}d overdue` : `due ${fmtDate(t.due_date)}`}
          </span>
        ) : null
      }
    />
  )
}

function DeliverableRow({ d, onSet }) {
  const reviewed = d.status === 'reviewed'
  return (
    <Row
      to={paths.session(d.session_id)}
      check={null}
      title={d.title}
      meta={`${d.consultee_name} · ${d.session_topic || 'Session'}`}
      right={
        <span className="flex shrink-0 items-center gap-2">
          {d.link && (
            <FileLink stored={d.link} className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c2410c] hover:underline">
              Open
            </FileLink>
          )}
          <StatusPill status={d.status} />
          <Button size="sm" variant={reviewed ? 'ghost' : 'dark'} onClick={() => onSet(d, reviewed ? (d.link ? 'submitted' : 'pending') : 'reviewed')}>
            {reviewed ? 'Undo' : '✓ Reviewed'}
          </Button>
        </span>
      }
    />
  )
}

export default function TasksBoardView() {
  const load = useLoad(admin.board, [])
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'tasks'
  const [student, setStudent] = useState('')
  const [filter, setFilter] = useState({ tasks: 'open', deliverables: 'waiting' })
  const [error, setError] = useState('')

  // Optimistic: apply locally, write, roll back on failure.
  const mutate = async (kind, row, changes, call) => {
    const key = kind === 'tasks' ? 'task_id' : 'deliverable_id'
    const apply = (patch) => load.setData((d) => ({ ...d, [kind]: d[kind].map((r) => (r[key] === row[key] ? { ...r, ...patch } : r)) }))
    setError('')
    apply(changes)
    try {
      await call()
    } catch (err) {
      apply(row)
      setError(err.message)
    }
  }
  const toggleTask = (t) => {
    const status = t.status === 'done' ? 'open' : 'done'
    return mutate('tasks', t, { status }, () => admin.updateTask(t.task_id, { status }))
  }
  const setDeliverable = (d, status) => mutate('deliverables', d, { status }, () => admin.updateDeliverable(d.deliverable_id, { status }))

  return (
    <Loaded load={load}>
      {({ today, tasks, deliverables }) => {
        const students = [...new Map([...tasks, ...deliverables].map((r) => [r.email, r.consultee_name]))].sort((a, b) => a[1].localeCompare(b[1]))
        const f = filter[tab]
        const mine = (r) => !student || r.email === student
        const shownTasks = tasks
          .filter(mine)
          .filter((t) => f === 'all' || (f === 'done' ? t.status === 'done' : t.status === 'open' && (f !== 'overdue' || (t.due_date && t.due_date < today))))
          .sort(byDue)
        const shownDeliverables = deliverables
          .filter(mine)
          .filter((d) => f === 'all' || (f === 'waiting' ? d.status === 'pending' : d.status === f))
        const rows = tab === 'tasks' ? shownTasks : shownDeliverables
        const openCount = tasks.filter((t) => t.status === 'open').length
        return (
          <Page>
            <PageHeader n={5} eyebrow="Tracker" title="Tasks & deliverables" subtitle="Everything set for every student. Tick things off as they’re done." />
            <motion.div variants={viewItem} className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs
                value={tab}
                onChange={(t) => setParams({ tab: t }, { replace: true })}
                tabs={[
                  { id: 'tasks', label: 'Tasks', count: openCount },
                  { id: 'deliverables', label: 'Deliverables', count: deliverables.filter((d) => d.status !== 'reviewed').length },
                ]}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <select aria-label="Filter by student" value={student} onChange={(e) => setStudent(e.target.value)} className={`${inputClass} sm:w-56`}>
                  <option value="">All students</option>
                  {students.map(([email, name]) => (
                    <option key={email} value={email}>
                      {name}
                    </option>
                  ))}
                </select>
                <select aria-label="Filter by status" value={f} onChange={(e) => setFilter((x) => ({ ...x, [tab]: e.target.value }))} className={`${inputClass} sm:w-52`}>
                  {(tab === 'tasks' ? TASK_FILTERS : DELIVERABLE_FILTERS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
            <div className="mt-3">
              <InlineError message={error} />
            </div>
            <motion.div variants={viewItem} className="mt-4">
              <p className={`${labelClass} mb-2`}>{rows.length} shown</p>
              {rows.length ? (
                <Card className="overflow-hidden">
                  {tab === 'tasks'
                    ? shownTasks.map((t) => <TaskRow key={t.task_id} t={t} today={today} onToggle={toggleTask} />)
                    : shownDeliverables.map((d) => <DeliverableRow key={d.deliverable_id} d={d} onSet={setDeliverable} />)}
                </Card>
              ) : (
                <EmptyState
                  mark="OK"
                  title={tab === 'tasks' ? 'No tasks here' : 'No deliverables here'}
                  body="Nothing matches these filters. Add them from a session."
                />
              )}
            </motion.div>
          </Page>
        )
      }}
    </Loaded>
  )
}
