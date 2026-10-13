import { useState } from 'react'
import { motion } from 'framer-motion'
import { useJunctionFetch } from '../../lib/useJunctionFetch.js'
import { hubPost, formatDate } from '../../lib/hubApi.js'
import {
  Page, ViewHeader, Pill, EmptyNote, Field, SaveNote, LoadingView, ErrorView,
  cardClass, inputClass, primaryButton, ghostButton, viewItem,
} from '../hub/ui.jsx'

// Hub Admin > Attendance: pick a cohort session, mark each real Startup Junction founder present or
// absent, save to the Attendance tab. Past sessions stay editable. The server refuses anyone who is not
// a Hub admin (403), and demo accounts never appear in the list.
export function AttendanceAdminView({ onUnauthorized }) {
  const list = useJunctionFetch('/api/hub/admin/attendance', onUnauthorized)
  const [sessionId, setSessionId] = useState('')

  if (list.loading && !list.data) return <LoadingView label="Loading sessions…" />
  if (list.error && !list.data) return <ErrorView message={list.error} onRetry={list.refetch} />
  const sessions = [...list.data.sessions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Page>
      <ViewHeader
        eyebrow="Attendance"
        title="Mark who attended."
        subtitle="Pick a cohort session, tick present or absent for each founder, and save. Past sessions can be edited at any time."
      />
      {!sessions.length ? (
        <div className="mt-10">
          <EmptyNote>No cohort sessions yet. Add one under Content → Startup Junction sessions.</EmptyNote>
        </div>
      ) : (
        <motion.div variants={viewItem} className="mt-8 max-w-md">
          <Field label="Session" htmlFor="att-session">
            <select id="att-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={inputClass}>
              <option value="">Choose a session…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDate(s.date)} · {s.topic || s.id}
                  {s.held ? '' : ' (upcoming)'}
                </option>
              ))}
            </select>
          </Field>
        </motion.div>
      )}
      {sessionId && <Roster key={sessionId} sessionId={sessionId} onUnauthorized={onUnauthorized} />}
    </Page>
  )
}

function Roster({ sessionId, onUnauthorized }) {
  const load = useJunctionFetch(`/api/hub/admin/attendance?session=${encodeURIComponent(sessionId)}`, onUnauthorized)
  const [marks, setMarks] = useState(null) // { [email]: 'present' | 'absent' | '' }, set once the roster loads
  const [state, setState] = useState(null)

  if (load.loading && !load.data) return <LoadingView label="Loading students…" />
  if (load.error && !load.data) return <ErrorView message={load.error} onRetry={load.refetch} />
  const { session, students } = load.data
  const current = marks ?? Object.fromEntries(students.map((s) => [s.email, s.status]))
  const set = (email, status) => {
    setState(null)
    setMarks({ ...current, [email]: status })
  }
  const markAllPresent = () => {
    setState(null)
    setMarks(Object.fromEntries(students.map((s) => [s.email, 'present'])))
  }
  const toSave = students.filter((s) => current[s.email])
  const presentCount = students.filter((s) => current[s.email] === 'present').length

  async function save() {
    setState({ saving: true })
    try {
      const res = await hubPost('admin/attendance', { session_id: sessionId, marks: toSave.map((s) => ({ email: s.email, status: current[s.email] })) })
      load.setData(res)
      setMarks(null)
      setState({ saved: true })
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      setState({ error: err.message })
    }
  }

  return (
    <motion.div variants={viewItem} className={`${cardClass} mt-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">{session.topic || session.id}</p>
          <p className="text-xs text-black/50">
            {formatDate(session.date)} · {session.held ? 'held' : 'upcoming'} · {presentCount} of {students.length} present
          </p>
        </div>
        <button type="button" onClick={markAllPresent} disabled={!students.length} className={ghostButton}>
          Mark all present
        </button>
      </div>

      {!students.length ? (
        <p className="mt-6 text-sm text-black/55">No approved Startup Junction founders yet.</p>
      ) : (
        <ul className="mt-5 divide-y divide-black/[0.06]">
          {students.map((s) => (
            <li key={s.email} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 sm:flex-1">
                <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                <p className="truncate text-xs text-black/45">{s.email}</p>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label={`Attendance for ${s.name}`}>
                {['present', 'absent'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={current[s.email] === status}
                    onClick={() => set(s.email, status)}
                    className={`rounded-full border px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                      current[s.email] === status
                        ? status === 'present'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-red-500 bg-red-500 text-white'
                        : 'border-black/10 text-black/50 hover:border-orange/50 hover:text-ink'
                    }`}
                  >
                    {status}
                  </button>
                ))}
                {!current[s.email] && <Pill tone="neutral">Not marked</Pill>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={!toSave.length || state?.saving} className={primaryButton}>
          Save attendance
        </button>
        <SaveNote state={state} />
      </div>
    </motion.div>
  )
}
