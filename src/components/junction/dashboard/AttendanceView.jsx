import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { viewContainer, viewItem, ease } from './motionVariants.js'

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// held + present => present; held + not present => absent (an unmarked held
// session reads honestly as absent, not silently missing); not held => upcoming.
function statusFor(attendanceById) {
  return (session) => {
    const a = attendanceById.get(session.id)
    if (!a?.held) return 'upcoming'
    return a.present ? 'present' : 'absent'
  }
}

const STATUS_COPY = {
  present: { label: 'Present', dotClass: 'bg-orange', textClass: 'font-semibold text-orange' },
  absent: { label: 'Absent', dotClass: 'bg-black/25', textClass: 'font-semibold text-black/50' },
  // Deliberately no dot and a lighter weight than absent — this hasn't happened
  // yet, so it shouldn't visually read as an outcome the way present/absent do.
  upcoming: { label: 'Upcoming', dotClass: null, textClass: 'text-black/35' },
}

function AttendanceMeter({ presentCount, heldCount }) {
  if (heldCount === 0) {
    return (
      <p className="mt-6 max-w-md text-sm text-black/55">
        No sessions have been held yet — your attendance rate will show up here once the first one happens.
      </p>
    )
  }
  const pct = Math.round((presentCount / heldCount) * 100)
  return (
    <div className="mt-6 max-w-md">
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: pct / 100 }}
            transition={{ duration: 0.8, ease, delay: 0.2 }}
            style={{ transformOrigin: 'left' }}
            className="h-full rounded-full bg-orange"
          />
        </div>
        <span className="font-mono text-sm font-semibold text-ink">{pct}%</span>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-black/40">
        {presentCount} of {heldCount} sessions attended
      </p>
    </div>
  )
}

function AttendanceRow({ session, index, status }) {
  const copy = STATUS_COPY[status]
  return (
    <motion.div
      variants={viewItem}
      className="flex flex-col gap-2.5 rounded-xl border border-black/10 bg-surface px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
    >
      <div className="flex items-center gap-4 sm:w-72 sm:shrink-0">
        <span className="font-mono text-xs font-semibold text-black/30">[{String(index + 1).padStart(2, '0')}]</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{session.topic}</p>
          <p className="truncate text-xs text-black/45">with {session.mentor}</p>
        </div>
      </div>
      <span className="font-mono text-xs text-black/55 sm:w-28 sm:shrink-0">{formatDate(session.date)}</span>
      <div className="flex items-center gap-2 sm:ml-auto">
        {copy.dotClass && <span className={`h-2 w-2 rounded-full ${copy.dotClass}`} />}
        <span className={`font-mono text-[11px] uppercase tracking-wide ${copy.textClass}`}>{copy.label}</span>
      </div>
    </motion.div>
  )
}

export default function AttendanceView({ sessions, onUnauthorized }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null) // { sessions: [{session_id, held, present}], held_count, present_count }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch('/api/attendance')
      .then(async (res) => {
        if (res.status === 401) return onUnauthorized()
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Something went wrong.')
        if (!cancelled) setData(body)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Something went wrong.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onUnauthorized])

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-black/40">Loading attendance…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-sm font-medium text-red-500">{error}</p>
      </div>
    )
  }

  const attendanceById = new Map((data?.sessions || []).map((a) => [a.session_id, a]))
  const heldCount = data?.held_count ?? 0
  const presentCount = data?.present_count ?? 0
  const getStatus = statusFor(attendanceById)

  return (
    <motion.div variants={viewContainer} initial="hidden" animate="show" className="p-6 lg:p-10">
      <motion.p variants={viewItem} className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange">
        Attendance
      </motion.p>
      <motion.h2 variants={viewItem} className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {heldCount === 0 ? 'No sessions held yet.' : `${presentCount} of ${heldCount} sessions attended so far.`}
      </motion.h2>

      <motion.div variants={viewItem}>
        <AttendanceMeter presentCount={presentCount} heldCount={heldCount} />
      </motion.div>

      <div className="mt-10">
        <div className="hidden gap-6 px-5 sm:flex">
          <span className="w-72 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
            Session
          </span>
          <span className="w-28 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
            Date
          </span>
          <span className="ml-auto font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
            Status
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {sessions.map((session, i) => (
            <AttendanceRow key={session.id} session={session} index={i} status={getStatus(session)} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
