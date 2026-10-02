import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Section, EmptyState, StatusPill, Button, Spinner, viewItem } from '../ui.jsx'
import { DateBlock, SessionMeta } from '../sessionParts.jsx'
import { ChevronRightIcon } from '../../junction/dashboard/icons.jsx'
import { RescheduleNotice, rescheduleNotice } from './RescheduleNotice.jsx'
import { byDateTime, isUpcoming, isFinished, relativeDay, studentItems } from '../../../lib/consultingTime.js'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// What a finished session still needs from the student, as loud badges.
export function InputBadges({ session }) {
  const items = studentItems(session)
  const deliverables = items.filter((i) => i.kind === 'deliverable').length
  const openTasks = isFinished(session) ? session.tasks.filter((t) => t.status === 'open').length : 0
  const badges = [
    items.some((i) => i.kind === 'mom') && 'Add MoM',
    deliverables && (deliverables === 1 ? 'Upload deliverable' : `Upload ${deliverables} deliverables`),
    openTasks && plural(openTasks, 'open task'),
  ].filter(Boolean)
  if (!badges.length) return null
  return (
    <span className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b} className="rounded-full bg-orange px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink">
          {b}
        </span>
      ))}
    </span>
  )
}

function RemoveCancelled({ session, onRemove }) {
  const [state, setState] = useState({ busy: false, error: '' })
  const remove = async () => {
    setState({ busy: true, error: '' })
    try {
      await onRemove(session)
    } catch (err) {
      setState({ busy: false, error: err.message })
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-black/[0.06] px-4 py-3 sm:px-5">
      <p className="min-w-0 flex-1 text-sm text-black/55">Cancelled. It doesn’t count toward anything you owe.</p>
      <Button size="sm" variant="ghost" disabled={state.busy} onClick={remove}>
        {state.busy && <Spinner className="h-3 w-3" />} Remove
      </Button>
      {state.error && (
        <p role="alert" className="w-full text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}
    </div>
  )
}

function SessionCard({ session, onRemove }) {
  const notice = rescheduleNotice(session)
  return (
    <motion.li variants={viewItem} data-session-id={session.session_id} className="overflow-hidden rounded-2xl border border-black/10 bg-white transition-colors hover:border-orange/50">
      <Link
        to={`/consulting/sessions/${session.session_id}`}
        className="group flex items-center gap-4 p-4 outline-none focus-visible:ring-4 focus-visible:ring-orange/20 sm:gap-5 sm:p-5"
      >
        <DateBlock date={session.date} />
        <div className="min-w-0 flex-1">
          <p className={`font-display text-base font-bold leading-snug tracking-tight sm:text-lg ${session.status === 'cancelled' ? 'text-black/45 line-through decoration-black/25' : 'text-ink'}`}>
            {session.topic || 'Consulting session'}
          </p>
          <SessionMeta session={session} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={session.status} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/40">{relativeDay(session.date)}</span>
          </div>
          {notice && <RescheduleNotice notice={notice} compact />}
          <div className="mt-2">
            <InputBadges session={session} />
          </div>
        </div>
        <span className="h-5 w-5 shrink-0 text-black/30 transition-colors group-hover:text-orange">
          <ChevronRightIcon />
        </span>
      </Link>
      {session.status === 'cancelled' && <RemoveCancelled session={session} onRemove={onRemove} />}
    </motion.li>
  )
}

export default function SessionsView({ sessions, removeSession }) {
  const upcoming = sessions.filter((s) => isUpcoming(s)).sort(byDateTime)
  const past = sessions.filter((s) => !isUpcoming(s)).sort((a, b) => byDateTime(b, a))
  const waiting = past.filter((s) => studentItems(s).length).length

  return (
    <Page>
      <PageHeader
        n={2}
        eyebrow="Sessions"
        title="Your sessions"
        subtitle="Open a session to add your minutes, tick off tasks and hand in deliverables, all on one page."
      />
      <Section title="Upcoming" meta={String(upcoming.length)}>
        {upcoming.length ? (
          <ul className="space-y-3">
            {upcoming.map((s) => (
              <SessionCard key={s.session_id} session={s} onRemove={removeSession} />
            ))}
          </ul>
        ) : (
          <EmptyState mark="--" title="Nothing scheduled" body="Your consultant will book the next session." />
        )}
      </Section>
      <Section title="Past" meta={waiting ? `${waiting} need your input` : String(past.length)}>
        {past.length ? (
          <ul className="space-y-3">
            {past.map((s) => (
              <SessionCard key={s.session_id} session={s} onRemove={removeSession} />
            ))}
          </ul>
        ) : (
          <EmptyState mark="00" title="No past sessions yet" body="After a session ends, open it here to add your minutes and deliverables." />
        )}
      </Section>
    </Page>
  )
}
