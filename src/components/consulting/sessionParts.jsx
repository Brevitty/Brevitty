// Session building blocks shared by the student page and the admin timeline.
import { StatusPill, labelClass, Spinner, ORANGE_TEXT } from './ui.jsx'
import { CheckIcon } from '../junction/dashboard/icons.jsx'
import { fmtMonth, fmtDayNum, fmtDate, fmtRange, istToday } from '../../lib/consultingTime.js'

// Tear-off style date stub: "05 / OCT".
export function DateBlock({ date, dark = false, size = 'md' }) {
  const big = size === 'lg'
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center rounded-xl border ${
        dark ? 'border-white/15 bg-white/[0.04] text-white' : 'border-black/10 bg-[#fafaf8] text-ink'
      } ${big ? 'h-24 w-20' : 'h-16 w-14'}`}
    >
      <span className={`font-mono font-semibold tabular-nums leading-none ${big ? 'text-4xl' : 'text-2xl'}`}>{fmtDayNum(date)}</span>
      <span className={`mt-1 font-mono text-[10px] font-semibold tracking-[0.2em] ${dark ? 'text-orange' : ORANGE_TEXT}`}>{fmtMonth(date)}</span>
    </div>
  )
}

export function SessionMeta({ session }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-black/50">
      {fmtDate(session.date)} · {fmtRange(session)} IST
    </p>
  )
}

export function MomBlock({ mom, link }) {
  if (!mom) {
    return <p className="text-sm italic text-black/45">No minutes recorded for this session yet.</p>
  }
  return (
    <div className="relative border-l-2 border-orange pl-4">
      <p className="whitespace-pre-line text-sm leading-relaxed text-black/75">{mom}</p>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className={`mt-2 block break-all font-mono text-[11px] underline decoration-orange/40 underline-offset-2 ${ORANGE_TEXT}`}>
          {link.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  )
}

export const isOverdue = (t) => t.status === 'open' && t.due_date && t.due_date < istToday()

// Task checkbox row. `onToggle` omitted => read-only.
export function TaskRow({ task, onToggle, busy = false }) {
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const box = (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
        done ? 'border-ink bg-ink text-orange' : 'border-black/25 bg-white group-hover:border-orange'
      }`}
    >
      {busy ? <Spinner className="h-3 w-3 text-black/40" /> : done && <span className="h-3.5 w-3.5"><CheckIcon /></span>}
    </span>
  )
  const body = (
    <span className="min-w-0 flex-1 text-left">
      <span className={`block text-sm font-medium ${done ? 'text-black/40 line-through decoration-black/25' : 'text-ink'}`}>{task.task}</span>
      <span className={`mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] ${overdue ? 'text-red-600' : 'text-black/40'}`}>
        {done ? `Done ${fmtDate(task.completed_date)}` : task.due_date ? `${overdue ? 'Overdue · ' : 'Due '}${fmtDate(task.due_date)}` : 'No due date'}
      </span>
      {task.note && <span className="mt-1 block text-xs text-black/55">Note: {task.note}</span>}
    </span>
  )
  if (!onToggle) {
    return (
      <div className="flex items-start gap-3 py-2.5">
        {box}
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      disabled={busy}
      onClick={() => onToggle(task)}
      className="group flex w-full items-start gap-3 rounded-lg py-2.5 outline-none focus-visible:ring-4 focus-visible:ring-orange/20 disabled:cursor-wait"
    >
      {box}
      {body}
    </button>
  )
}

export function DeliverableRow({ d, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{d.title}</p>
        {d.link ? (
          <a
            href={d.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-0.5 block max-w-[34ch] truncate font-mono text-[11px] underline decoration-orange/40 underline-offset-2 hover:decoration-orange sm:max-w-[48ch] ${ORANGE_TEXT}`}
          >
            {d.link.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-black/40">No link yet</p>
        )}
        {d.note && <p className="mt-1 text-xs text-black/55">Note: {d.note}</p>}
      </div>
      <div className="flex items-center gap-2">
        {action}
        <StatusPill status={d.status} />
      </div>
    </div>
  )
}

// Read-only session body: MoM, tasks, deliverables. Used by admin timeline.
export function SessionBody({ session }) {
  return (
    <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
      <div>
        <p className={`${labelClass} mb-2`}>Minutes of meeting</p>
        <MomBlock mom={session.mom} link={session.mom_link} />
      </div>
      <div className="space-y-5">
        <div>
          <p className={labelClass}>Tasks · {session.tasks.length}</p>
          {session.tasks.length ? (
            <div className="divide-y divide-black/5">{session.tasks.map((t) => <TaskRow key={t.task_id} task={t} />)}</div>
          ) : (
            <p className="mt-2 text-sm text-black/40">None set.</p>
          )}
        </div>
        <div>
          <p className={labelClass}>Deliverables · {session.deliverables.length}</p>
          {session.deliverables.length ? (
            <div className="divide-y divide-black/5">{session.deliverables.map((d) => <DeliverableRow key={d.deliverable_id} d={d} />)}</div>
          ) : (
            <p className="mt-2 text-sm text-black/40">None set.</p>
          )}
        </div>
      </div>
    </div>
  )
}
