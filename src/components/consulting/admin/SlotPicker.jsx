import { slotGrid, toMin, fmtTime } from '../../../lib/consultingTime.js'
import { DURATIONS_MIN, SLOT_STEP_MIN } from '../../../data/consultingConstants.js'
import { labelClass } from '../ui.jsx'

const DISABLED_STRIPES = {
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(10,10,10,0.05) 0 6px, transparent 6px 12px)',
}

export function DurationPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Duration" className="inline-flex rounded-full border border-black/10 bg-white p-1">
      {DURATIONS_MIN.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={`min-h-[40px] rounded-full px-5 font-mono text-xs font-semibold tracking-[0.1em] transition-colors ${
            value === m ? 'bg-ink text-white' : 'text-black/55 hover:text-ink'
          }`}
        >
          {m} MIN
        </button>
      ))}
    </div>
  )
}

// 30-minute grid, 10:00–18:00 IST. Taken / too-late / passed starts are disabled
// (same rules the API enforces). The chosen session's full span is highlighted.
export default function SlotPicker({ date, duration, sessions, ignoreId, value, onChange }) {
  const slots = slotGrid(date, duration, sessions, ignoreId)
  const chosen = slots.find((s) => s.start_time === value && !s.reason)
  const inSpan = (s) => chosen && toMin(s.start_time) >= toMin(chosen.start_time) && toMin(s.start_time) < toMin(chosen.end_time)
  const free = slots.filter((s) => !s.reason).length

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {slots.map((s) => {
          const isStart = chosen?.start_time === s.start_time
          const covered = !isStart && inSpan(s)
          return (
            <button
              key={s.start_time}
              type="button"
              disabled={Boolean(s.reason)}
              aria-pressed={isStart}
              onClick={() => onChange(s.start_time)}
              title={s.reason ? `${s.reason}${s.clash?.consultee_name ? ` · ${s.clash.consultee_name}` : ''}` : `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`}
              style={s.reason ? DISABLED_STRIPES : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border px-1 outline-none transition-colors focus-visible:ring-4 focus-visible:ring-orange/25 ${
                isStart
                  ? 'border-orange bg-orange text-ink shadow-[0_8px_20px_-10px_rgba(249,115,22,0.9)]'
                  : covered
                    ? 'border-orange/40 bg-orange/15 text-ink'
                    : s.reason
                      ? 'cursor-not-allowed border-black/5 text-black/30'
                      : 'border-black/10 bg-white text-ink hover:border-orange/60'
              }`}
            >
              <span className={`font-mono text-sm font-semibold tabular-nums ${s.reason ? 'line-through decoration-black/20' : ''}`}>{s.start_time}</span>
              <span className="mt-0.5 max-w-full truncate font-mono text-[9px] uppercase tracking-[0.1em] opacity-70">
                {s.reason ? (s.clash?.consultee_name?.split(/\s+/)[0] ?? s.reason) : isStart ? `to ${s.end_time}` : covered ? '·' : ''}
              </span>
            </button>
          )
        })}
      </div>
      <p className={`mt-3 ${labelClass}`}>
        {free} of {slots.length} starts free · {SLOT_STEP_MIN}-min grid · IST
      </p>
    </div>
  )
}
