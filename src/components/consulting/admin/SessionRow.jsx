import { Link } from 'react-router-dom'
import { StatusPill } from '../ui.jsx'
import { DateBlock } from '../sessionParts.jsx'
import { ChevronRightIcon } from '../../junction/dashboard/icons.jsx'
import { fmtRange, relativeDay } from '../../../lib/consultingTime.js'
import { paths } from './paths.js'

// One clickable session line used by Today, Sessions and the Schedule "day" preview.
export default function SessionRow({ session, showDate = true }) {
  return (
    <Link
      to={paths.session(session.session_id)}
      className="group flex items-center gap-4 rounded-2xl border border-black/10 bg-white p-4 outline-none transition-colors hover:border-orange/40 focus-visible:ring-4 focus-visible:ring-orange/20 sm:p-5"
    >
      {showDate ? (
        <DateBlock date={session.date} />
      ) : (
        <div className="w-16 shrink-0">
          <p className="font-mono text-xl font-semibold tabular-nums text-ink">{session.start_time}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-black/40">to {session.end_time}</p>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-bold tracking-tight text-ink sm:text-lg">{session.consultee_name}</p>
        <p className="truncate text-sm text-black/55">{session.topic || 'No topic set'}</p>
        {showDate && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-black/40">
            {fmtRange(session)} · {relativeDay(session.date)}
          </p>
        )}
      </div>
      <StatusPill status={session.status} />
      <span className="hidden h-5 w-5 shrink-0 text-black/25 transition-colors group-hover:text-orange sm:block">
        <ChevronRightIcon />
      </span>
    </Link>
  )
}
