import { useState } from 'react'
import { motion } from 'framer-motion'
import { Page, PageHeader, Section, Card, EmptyState, viewItem } from '../ui.jsx'
import { isOverdue } from '../sessionParts.jsx'
import { TaskItem, SavedBanner } from './parts.jsx'

// To do: overdue first, then by due date, undated last. Done: most recently finished first.
const byDue = (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')
const byCompleted = (a, b) => (b.completed_date || '').localeCompare(a.completed_date || '')

function TaskList({ tasks, sessionsById, updateTask }) {
  return (
    <Card className="px-5 py-5">
      <ul className="divide-y divide-black/[0.06]">
        {tasks.map((t) => (
          <TaskItem key={t.task_id} task={t} session={sessionsById[t.session_id]} onUpdate={updateTask} />
        ))}
      </ul>
    </Card>
  )
}

// Every task from every session on one page. Tick to finish; a note is optional.
export default function TasksView({ sessions, updateTask }) {
  const [banner, setBanner] = useState('')
  const save = async (task, changes) => {
    await updateTask(task, changes)
    setBanner(changes.status === 'done' ? `Marked done: ${task.task}` : changes.status === 'open' ? `Moved back to To do: ${task.task}` : `Note saved: ${task.task}`)
  }
  const sessionsById = Object.fromEntries(sessions.map((s) => [s.session_id, s]))
  // A cancelled session's tasks no longer count.
  const tasks = sessions.filter((s) => s.status !== 'cancelled').flatMap((s) => s.tasks)
  const todo = tasks.filter((t) => t.status === 'open')
  const overdue = todo.filter(isOverdue).sort(byDue)
  const rest = todo.filter((t) => !isOverdue(t)).sort(byDue)
  const done = tasks.filter((t) => t.status === 'done').sort(byCompleted)

  return (
    <Page>
      <PageHeader n={3} eyebrow="Tasks" title="What you owe" subtitle="Every task from every session, in one place. Tick it off when it’s done." />
      <SavedBanner message={banner} />
      {!tasks.length ? (
        <motion.div variants={viewItem} className="mt-8">
          <EmptyState mark="00" title="No tasks yet" body="Tasks your consultant sets during sessions will appear here." />
        </motion.div>
      ) : (
        <>
          <Section n={1} title="To do" meta={`${todo.length} open${overdue.length ? ` · ${overdue.length} overdue` : ''}`}>
            {todo.length ? (
              <TaskList tasks={[...overdue, ...rest]} sessionsById={sessionsById} updateTask={save} />
            ) : (
              <EmptyState mark="OK" title="All clear" body="Nothing to do. Nice." />
            )}
          </Section>
          <Section n={2} title="Done" meta={`${done.length} done`}>
            {done.length ? (
              <TaskList tasks={done} sessionsById={sessionsById} updateTask={save} />
            ) : (
              <EmptyState mark="--" title="Nothing done yet" body="Completed tasks move here." />
            )}
          </Section>
        </>
      )}
    </Page>
  )
}
