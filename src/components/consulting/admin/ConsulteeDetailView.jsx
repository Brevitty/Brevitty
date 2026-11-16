import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Section, Card, EmptyState, StatusPill, Loaded, viewItem, labelClass, ORANGE_TEXT } from '../ui.jsx'
import { DateBlock, SessionMeta, SessionBody } from '../sessionParts.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import { admin } from '../../../lib/consultingApi.js'
import { byDateTime, fmtDate, isUpcoming } from '../../../lib/consultingTime.js'
import EditConsulteeForm from './EditConsulteeForm.jsx'
import { Button } from '../ui.jsx'
import { paths } from './paths.js'

function Profile({ c }) {
  const [reveal, setReveal] = useState(false)
  const rows = [
    ['Email', c.email],
    ['Phone', c.phone],
    ['Department', c.department],
    ['Course', c.course],
    ['Semester', c.sem],
    ['Added', fmtDate(c.created_date)],
  ]
  return (
    <motion.div variants={viewItem}>
      <Card className="mt-8 grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <p className={labelClass}>{k}</p>
            <p className="mt-1 truncate text-sm text-ink">{v || '—'}</p>
          </div>
        ))}
        <div>
          <p className={labelClass}>Password</p>
          <button type="button" onClick={() => setReveal((r) => !r)} className="mt-1 font-mono text-sm text-ink hover:text-[#c2410c]">
            {reveal ? c.password : '••••••••'} <span className="ml-1 text-[10px] uppercase tracking-[0.14em] text-black/40">{reveal ? 'hide' : 'show'}</span>
          </button>
        </div>
      </Card>
    </motion.div>
  )
}

// Vertical timeline: newest at the top, each node a session with its full record.
function Timeline({ sessions }) {
  const ordered = [...sessions].sort((a, b) => byDateTime(b, a))
  return (
    <ol className="relative ml-2 border-l-2 border-black/10 pl-6 sm:ml-4 sm:pl-10">
      {ordered.map((s) => {
        const upcoming = isUpcoming(s)
        return (
          <motion.li key={s.session_id} variants={viewItem} className="relative pb-8 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute -left-[33px] top-5 h-4 w-4 rounded-full border-[3px] border-[#fafaf8] sm:-left-[49px] ${
                upcoming ? 'bg-orange ring-4 ring-orange/20' : s.status === 'completed' ? 'bg-ink' : 'bg-black/25'
              }`}
            />
            <Card className={`p-5 sm:p-6 ${upcoming ? 'border-orange/30' : ''}`}>
              <div className="flex items-start gap-4">
                <DateBlock date={s.date} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-bold tracking-tight text-ink">{s.topic || 'Consulting session'}</p>
                    <StatusPill status={s.status} />
                  </div>
                  <SessionMeta session={s} />
                </div>
                <Link to={paths.session(s.session_id)} className={`hidden shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] sm:block ${ORANGE_TEXT} hover:underline`}>
                  Open →
                </Link>
              </div>
              {!upcoming && (
                <div className="mt-5 border-t border-black/[0.06] pt-5">
                  <SessionBody session={s} />
                </div>
              )}
              <Link to={paths.session(s.session_id)} className={`mt-4 inline-block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] sm:hidden ${ORANGE_TEXT}`}>
                Open session →
              </Link>
            </Card>
          </motion.li>
        )
      })}
    </ol>
  )
}

export default function ConsulteeDetailView() {
  const { email } = useParams()
  const load = useLoad(() => admin.consultee(email), [email])
  const [editing, setEditing] = useState(false)
  return (
    <Loaded load={load}>
      {({ consultee, sessions }) => {
        const tasks = sessions.flatMap((s) => s.tasks)
        return (
          <Page>
            <motion.div variants={viewItem}>
              <Link to={paths.consultees} className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45 hover:text-ink">
                ← All students
              </Link>
            </motion.div>
            <div className="mt-4">
              <PageHeader
                eyebrow={consultee.startup_name || 'Student'}
                title={consultee.name}
                subtitle={`${sessions.length} sessions · ${tasks.filter((t) => t.status === 'open').length} open tasks · ${tasks.filter((t) => t.status === 'done').length} done`}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => setEditing((e) => !e)}>
                      Edit / reset password
                    </Button>
                    <Link to={paths.schedule(consultee.email)} className="inline-flex min-h-[44px] items-center rounded-full bg-orange px-5 text-sm font-bold text-ink hover:bg-[#fb8a3c]">
                      + Schedule session
                    </Link>
                  </div>
                }
              />
            </div>
            {editing && (
              <EditConsulteeForm
                consultee={consultee}
                onClose={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false)
                  load.reload()
                }}
              />
            )}
            <Profile c={consultee} />
            <Section n={1} title="Open tasks" meta={`${tasks.filter((t) => t.status === 'open').length} open`}>
              {tasks.some((t) => t.status === 'open') ? (
                <Card className="divide-y divide-black/[0.06]">
                  {sessions.flatMap((s) =>
                    s.tasks
                      .filter((t) => t.status === 'open')
                      .map((t) => (
                        <Link key={t.task_id} to={paths.session(s.session_id)} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-black/[0.015]">
                          <span className="text-sm font-medium text-ink">{t.task}</span>
                          <span className="shrink-0 font-mono text-[11px] text-black/50">{t.due_date ? `due ${fmtDate(t.due_date)}` : 'no due date'}</span>
                        </Link>
                      ))
                  )}
                </Card>
              ) : (
                <EmptyState mark="OK" title="No open tasks" body="Nothing is waiting on this student." />
              )}
            </Section>
            <Section n={2} title="Sessions" meta="newest first">
              {sessions.length ? (
                <Timeline sessions={sessions} />
              ) : (
                <EmptyState mark="00" title="No sessions yet" body="Book their first session to start the record." />
              )}
            </Section>
          </Page>
        )
      }}
    </Loaded>
  )
}
