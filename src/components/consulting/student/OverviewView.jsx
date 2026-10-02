// Home: an action center. Top to bottom: what needs attention (one tap to fix each), the next
// sessions, and the open tasks. What counts as "missing" comes from the shared rules in
// api/_lib/consulting/missing.js, the same ones sir's Today view uses.
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Section, Card, EmptyState, viewItem, ORANGE_TEXT } from '../ui.jsx'
import { DateBlock } from '../sessionParts.jsx'
import { RescheduleNotice, rescheduleNotice } from './RescheduleNotice.jsx'
import {
  byDateTime, fmtDate, fmtRange, isUpcoming, istToday, relativeDay, studentItems, waitingOnSir,
} from '../../../lib/consultingTime.js'

const UPCOMING_SHOWN = 3
const TASKS_SHOWN = 5
const byDue = (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')

// One tappable row. `tone` colours the tag: orange = yours to do, red = overdue, sir = waiting on sir.
function Attention({ to, title, sub, tag, tone = 'orange' }) {
  return (
    <li>
      <Link to={to} className="group flex min-h-[56px] items-center gap-3 px-4 py-3 outline-none hover:bg-orange/[0.05] focus-visible:bg-orange/[0.08]">
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${
            tone === 'sir' ? 'border border-black/15 bg-black/[0.04] text-black/60' : tone === 'red' ? 'bg-red-600 text-white' : 'bg-orange text-ink'
          }`}
        >
          {tag}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{title}</span>
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-black/45">{sub}</span>
        </span>
        <span aria-hidden="true" className={`${ORANGE_TEXT} transition-transform group-hover:translate-x-0.5`}>→</span>
      </Link>
    </li>
  )
}

function attentionRows(sessions) {
  const rows = []
  const label = (s) => `${fmtDate(s.date)} · ${s.topic || 'Session'}`
  const sessionPath = (s) => `/consulting/sessions/${s.session_id}`
  for (const s of [...sessions].sort(byDateTime)) {
    const notice = rescheduleNotice(s)
    if (notice) {
      rows.push({ key: `rs-${s.session_id}`, to: sessionPath(s), tag: 'Moved', title: `Rescheduled by sir: ${s.topic || 'Session'}`, sub: `${notice.from} → ${notice.to}` })
    }
    for (const i of studentItems(s)) {
      if (i.kind === 'mom') rows.push({ key: `mom-${s.session_id}`, to: sessionPath(s), tag: 'Add MoM', title: 'Add the minutes of meeting', sub: label(s) })
      if (i.kind === 'deliverable') rows.push({ key: i.id, to: sessionPath(s), tag: 'Submit', title: i.label, sub: `Deliverable · ${label(s)}` })
      if (i.kind === 'task') rows.push({ key: i.id, to: '/consulting/tasks', tag: 'Overdue', tone: 'red', title: i.label, sub: `Task · ${label(s)}` })
    }
    for (const i of waitingOnSir(s)) {
      rows.push({
        key: `sir-${i.kind}-${s.session_id}`,
        to: sessionPath(s),
        tag: 'Waiting on sir',
        tone: 'sir',
        title: i.kind === 'tasks' ? 'Sir hasn’t set tasks yet' : 'Sir hasn’t set deliverables yet',
        sub: label(s),
      })
    }
  }
  return rows
}

export default function OverviewView({ account, sessions }) {
  const rows = attentionRows(sessions)
  const today = istToday()
  const upcoming = sessions.filter((s) => isUpcoming(s)).sort(byDateTime).slice(0, UPCOMING_SHOWN)
  const tasks = sessions.filter((s) => s.status !== 'cancelled').flatMap((s) => s.tasks.map((t) => ({ t, s })))
  const open = tasks.filter(({ t }) => t.status === 'open').sort((a, b) => byDue(a.t, b.t))
  const firstName = account.name?.split(/\s+/)[0] || 'there'

  return (
    <Page>
      <PageHeader
        n={1}
        eyebrow={account.startup_name ? `Home · ${account.startup_name}` : 'Home'}
        title={`Hi ${firstName}.`}
        subtitle="What needs you today, what’s coming up, and what’s still open."
      />

      <Section n={1} title="Needs your attention" meta={rows.length ? String(rows.length) : ''}>
        {rows.length ? (
          <Card className="overflow-hidden">
            <ul data-testid="attention-list" className="divide-y divide-black/[0.06]">
              {rows.map(({ key, ...r }) => (
                <Attention key={key} {...r} />
              ))}
            </ul>
          </Card>
        ) : (
          <motion.div variants={viewItem} role="status" data-testid="all-caught-up" className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-6 py-8 text-center">
            <p className="font-display text-xl font-bold text-emerald-900">You’re all caught up</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-emerald-900/70">Nothing is missing from you, and nothing is waiting on sir.</p>
          </motion.div>
        )}
      </Section>

      <Section n={2} title="Upcoming sessions" meta={upcoming.length ? `next ${upcoming.length}` : ''}>
        {upcoming.length ? (
          <ul className="space-y-3">
            {upcoming.map((s) => {
              const prep = s.tasks.filter((t) => t.status === 'open')
              const notice = rescheduleNotice(s)
              return (
                <motion.li key={s.session_id} variants={viewItem}>
                  <Link to={`/consulting/sessions/${s.session_id}`} className="block rounded-2xl border border-black/10 bg-white p-4 outline-none hover:border-orange/50 focus-visible:ring-4 focus-visible:ring-orange/20 sm:p-5">
                    <div className="flex items-start gap-4">
                      <DateBlock date={s.date} />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base font-bold leading-snug text-ink sm:text-lg">{s.topic || 'Consulting session'}</p>
                        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-black/50">
                          {fmtDate(s.date)} · {fmtRange(s)} IST · {relativeDay(s.date)}
                        </p>
                        {notice && <RescheduleNotice notice={notice} compact />}
                        {prep.length > 0 && (
                          <p className="mt-2 text-sm text-black/60">
                            <span className="font-semibold text-ink">Prep:</span> {prep.map((t) => t.task).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.li>
              )
            })}
          </ul>
        ) : (
          <EmptyState mark="--" title="No session booked yet" body="Your consultant will schedule the next one. It’ll show up here." />
        )}
      </Section>

      <Section n={3} title="Open tasks" meta={open.length ? `${open.length} open` : ''}>
        {open.length ? (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-black/[0.06]">
              {open.slice(0, TASKS_SHOWN).map(({ t, s }) => {
                const overdue = t.due_date && t.due_date < today
                return (
                  <li key={t.task_id}>
                    <Link to="/consulting/tasks" className="flex min-h-[56px] items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
                      <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-md border-2 border-black/25" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{t.task}</span>
                        <span className={`block truncate font-mono text-[10px] uppercase tracking-[0.12em] ${overdue ? 'text-red-600' : 'text-black/45'}`}>
                          {t.due_date ? `${overdue ? 'Overdue · ' : 'Due '}${fmtDate(t.due_date)}` : 'No due date'} · {s.topic || 'Session'}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Link to="/consulting/tasks" className={`flex min-h-[48px] items-center border-t border-black/[0.06] px-4 text-sm font-semibold ${ORANGE_TEXT} hover:bg-orange/[0.05]`}>
              {open.length > TASKS_SHOWN ? `See all ${open.length} tasks →` : 'Open the Tasks page →'}
            </Link>
          </Card>
        ) : (
          <EmptyState mark="OK" title="No open tasks" body="You’re all clear." />
        )}
      </Section>
    </Page>
  )
}
