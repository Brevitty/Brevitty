import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Section, Card, EmptyState, Stat, Loaded, viewItem, ORANGE_TEXT } from '../ui.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import { admin } from '../../../lib/consultingApi.js'
import { fmtDate, fmtWeekday, daysFromToday, greeting } from '../../../lib/consultingTime.js'
import { INACTIVE_AFTER_DAYS } from '../../../data/consultingConstants.js'
import SessionRow from './SessionRow.jsx'
import MissingLists from './MissingLists.jsx'
import { paths } from './paths.js'

const linkBtn = 'inline-flex min-h-[44px] items-center rounded-full bg-orange px-5 text-sm font-bold text-ink shadow-[0_10px_24px_-12px_rgba(249,115,22,0.8)] hover:bg-[#fb8a3c]'

export default function TodayView() {
  const load = useLoad(admin.summary, [])
  return (
    <Loaded load={load}>
      {(d) => (
        <Page>
          <PageHeader
            n={1}
            eyebrow={`Today · ${fmtWeekday(d.today)} ${fmtDate(d.today)}`}
            title={`${greeting()}.`}
            subtitle="Who you’re seeing today, what’s slipped, and who has gone quiet."
            action={
              <Link to={paths.schedule()} className={linkBtn}>
                + Schedule a session
              </Link>
            }
          />

          <motion.div variants={viewItem} className="mt-8 grid grid-cols-3 gap-4 rounded-2xl bg-ink p-5 text-white sm:p-6">
            <Stat onDark tone="orange" value={d.sessions_today.length} label="Sessions today" />
            <Stat onDark tone={d.overdue_tasks.length ? 'red' : 'ink'} value={d.overdue_tasks.length} label="Overdue tasks" />
            <Stat onDark value={d.inactive_consultees.length} label={`Quiet ${INACTIVE_AFTER_DAYS}d+`} />
          </motion.div>

          <MissingLists fromStudents={d.missing_from_students} fromMe={d.missing_from_me} n={2} />

          <Section n={4} title="Today’s sessions" meta={`${d.sessions_today.length} booked`}>
            {d.sessions_today.length ? (
              <div className="space-y-3">
                {d.sessions_today.map((s) => (
                  <SessionRow key={s.session_id} session={s} showDate={false} />
                ))}
              </div>
            ) : (
              <EmptyState mark="--" title="A clear day" body="No sessions booked for today." />
            )}
          </Section>

          <div className="grid gap-x-6 lg:grid-cols-2">
            <Section n={5} title="Overdue tasks" meta={d.overdue_tasks.length ? 'oldest first' : ''}>
              {d.overdue_tasks.length ? (
                <Card className="divide-y divide-black/[0.06]">
                  {d.overdue_tasks.map((t) => (
                    <Link key={t.task_id} to={paths.session(t.session_id)} className="flex items-start gap-4 px-5 py-4 hover:bg-black/[0.015]">
                      <span className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-red-600">{-daysFromToday(t.due_date)}d</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{t.task}</span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-black/45">
                          {t.consultee_name} · due {fmtDate(t.due_date)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </Card>
              ) : (
                <EmptyState mark="OK" title="Nothing overdue" body="Every open task is still within its due date." />
              )}
            </Section>

            <Section n={6} title="Gone quiet" meta={`no session in ${INACTIVE_AFTER_DAYS} days`}>
              {d.inactive_consultees.length ? (
                <Card className="divide-y divide-black/[0.06]">
                  {d.inactive_consultees.map((c) => (
                    <div key={c.email} className="flex items-center gap-4 px-5 py-4">
                      <Link to={paths.consultee(c.email)} className="min-w-0 flex-1 hover:underline">
                        <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-black/45">
                          {c.startup_name || c.email} · {c.last_session_date ? `last ${fmtDate(c.last_session_date)}` : 'never met'}
                        </span>
                      </Link>
                      <Link to={paths.schedule(c.email)} className={`shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${ORANGE_TEXT} hover:underline`}>
                        Book →
                      </Link>
                    </div>
                  ))}
                </Card>
              ) : (
                <EmptyState mark="OK" title="Everyone’s active" body={`Every consultee has had or has a session within ${INACTIVE_AFTER_DAYS} days.`} />
              )}
            </Section>
          </div>
        </Page>
      )}
    </Loaded>
  )
}
