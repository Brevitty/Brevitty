import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { viewContainer, viewItem } from './motionVariants.js'
import { useJunctionFetch } from '../../../lib/useJunctionFetch.js'
import { LoadingView, ErrorView } from '../../hub/ui.jsx'

function ProgressControl({ sessionId, progress, onSave }) {
  const [completed, setCompleted] = useState(Boolean(progress?.completed))
  const [quizScore, setQuizScore] = useState(progress?.quiz_score ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    setCompleted(Boolean(progress?.completed))
    setQuizScore(progress?.quiz_score ?? '')
  }, [progress])

  const dirty = completed !== Boolean(progress?.completed) || String(quizScore) !== String(progress?.quiz_score ?? '')

  const save = async () => {
    setSaving(true)
    setSaveError('')
    const ok = await onSave(sessionId, completed, quizScore === '' ? null : Number(quizScore))
    setSaving(false)
    if (!ok) setSaveError('Could not save. Try again.')
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3">
      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
          className="h-4 w-4 rounded border-black/20 text-orange focus:ring-orange"
        />
        Mark as completed
      </label>
      <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-black/50">
        Quiz score
        <input
          type="number"
          min="0"
          max="100"
          value={quizScore}
          onChange={(e) => setQuizScore(e.target.value)}
          placeholder="—"
          className="w-16 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm text-ink outline-none focus:border-orange"
        />
      </label>
      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-orange px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
      {saveError && <span className="text-xs font-medium text-red-500">{saveError}</span>}
    </div>
  )
}

function SessionRow({ session, index, progress, onSaveProgress }) {
  const isPast = session.status === 'past'
  return (
    <motion.div
      variants={viewItem}
      className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-surface p-6 sm:flex-row sm:gap-6"
    >
      <span className="font-mono text-sm font-semibold text-black/30">[{String(index + 1).padStart(2, '0')}]</span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-display text-lg font-bold tracking-tight text-ink">{session.topic}</p>
          <span className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wide text-black/50">
            {isPast ? 'completed' : 'upcoming'}
          </span>
        </div>
        <p className="mt-1 text-sm text-black/55">
          {session.date}{session.mentor ? ` — with ${session.mentor}` : ''}
        </p>
        {isPast && session.summary && <p className="mt-3 text-sm leading-relaxed text-black/65">{session.summary}</p>}
        {isPast && session.actionItem && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#c2410c]">
            Action: {session.actionItem}
          </p>
        )}
        {isPast && <ProgressControl sessionId={session.id} progress={progress} onSave={onSaveProgress} />}
      </div>
    </motion.div>
  )
}

export default function SessionsView({ sessions, onUnauthorized }) {
  const { loading, error, data, refetch } = useJunctionFetch('/api/session-progress', onUnauthorized)
  const progressById = data?.sessions || {}

  const saveProgress = async (sessionId, completed, quizScore) => {
    try {
      const res = await fetch('/api/session-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, completed, quiz_score: quizScore }),
      })
      if (res.status === 401) {
        onUnauthorized()
        return false
      }
      if (!res.ok) return false
      refetch()
      return true
    } catch {
      return false
    }
  }

  if (loading && !data) return <LoadingView label="Loading sessions…" />
  if (error && !data) return <ErrorView message={error} onRetry={refetch} />

  const upcoming = sessions.filter((s) => s.status === 'upcoming')
  const past = sessions.filter((s) => s.status === 'past')

  return (
    <motion.div variants={viewContainer} initial="hidden" animate="show" className="p-6 lg:p-10">
      <motion.p variants={viewItem} className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange">
        Mentor sessions
      </motion.p>
      <motion.h2 variants={viewItem} className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Upcoming and past sessions.
      </motion.h2>

      {upcoming.length > 0 && (
        <div className="mt-10">
          <motion.h3
            variants={viewItem}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45"
          >
            Upcoming
          </motion.h3>
          <div className="mt-5 flex flex-col gap-4">
            {upcoming.map((s, i) => (
              <SessionRow key={s.id} session={s} index={i} progress={progressById[s.id]} onSaveProgress={saveProgress} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-10">
          <motion.h3
            variants={viewItem}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45"
          >
            Past
          </motion.h3>
          <div className="mt-5 flex flex-col gap-4">
            {past.map((s, i) => (
              <SessionRow key={s.id} session={s} index={i} progress={progressById[s.id]} onSaveProgress={saveProgress} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
