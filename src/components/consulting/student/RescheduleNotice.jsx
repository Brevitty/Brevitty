import { fmtDay, fmtRange, parseSlotToken } from '../../../lib/consultingTime.js'

const slotText = (s) => `${fmtDay(s.date)}, ${fmtRange(s)}`

// { from, to } when sir moved this session and the student hasn't opened it since, else null.
export function rescheduleNotice(session) {
  const from = parseSlotToken(session.rescheduled_from)
  if (!from || session.reschedule_seen === 'TRUE') return null
  return { from: slotText(from), to: slotText(session) }
}

export function RescheduleNotice({ notice, compact = false }) {
  return (
    <p role="status" className={`${compact ? 'mt-2 text-xs' : 'mt-5 text-sm'} rounded-xl border border-orange/30 bg-orange/[0.08] px-3 py-2 font-medium leading-relaxed text-[#9a3412]`}>
      Rescheduled by sir: <span className="line-through decoration-[#9a3412]/40">{notice.from}</span> → <strong>{notice.to}</strong>
    </p>
  )
}
