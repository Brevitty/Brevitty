import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TabBar } from '../junction/dashboard/shared.jsx'
import { ease } from '../junction/dashboard/motionVariants.js'
import { formatDate, formatTime } from '../../lib/hubApi.js'
import { Page, ViewHeader, Pill, Field, SaveNote, EmptyNote, inputClass, primaryButton, viewItem, pad2 } from '../hub/ui.jsx'

const NOTE_FIELDS = [
  { id: 'mom', label: 'Minutes of meeting (MoM)', hint: 'What you discussed and decided.' },
  { id: 'deliverables', label: 'Deliverables', hint: 'What you will hand in, with links if you have them.' },
  { id: 'tasks', label: 'Task updates', hint: 'Progress on the tasks from this session.' },
]

function SessionNotes({ session, onSave }) {
  const [values, setValues] = useState(() => Object.fromEntries(NOTE_FIELDS.map((f) => [f.id, session[f.id] || ''])))
  const [state, setState] = useState(null)
  const changed = Object.fromEntries(NOTE_FIELDS.filter((f) => values[f.id].trim() !== (session[f.id] || '')).map((f) => [f.id, values[f.id].trim()]))

  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await onSave(changed)
      setState({ saved: true })
    } catch (err) {
      setState({ error: err.message })
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4 border-t border-black/[0.06] pt-5">
      {NOTE_FIELDS.map((f) => (
        <Field key={f.id} label={f.label} htmlFor={`${session.sessionId}-${f.id}`} hint={f.hint}>
          <textarea
            id={`${session.sessionId}-${f.id}`}
            rows={3}
            maxLength={2000}
            value={values[f.id]}
            onChange={(e) => {
              setValues((v) => ({ ...v, [f.id]: e.target.value }))
              setState(null)
            }}
            className={inputClass}
          />
        </Field>
      ))}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!Object.keys(changed).length || state?.saving} className={primaryButton}>
          Save session notes
        </button>
        <SaveNote state={state} />
      </div>
    </form>
  )
}

function SessionCard({ session, index, open, onToggle, onSave }) {
  const editable = session.past && session.status !== 'cancelled'
  const filled = ['mom', 'deliverables', 'tasks'].filter((k) => session[k]).length
  return (
    <motion.div variants={viewItem} className={`rounded-xl border bg-surface px-5 py-4 ${open ? 'border-orange/40' : 'border-black/10'}`}>
      <button type="button" onClick={editable ? onToggle : undefined} disabled={!editable} aria-expanded={editable ? open : undefined} className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center gap-4 sm:w-72 sm:shrink-0">
          <span className="font-mono text-xs font-semibold text-black/30">[{pad2(index + 1)}]</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">Mentor session</p>
            <p className="truncate text-xs text-black/45">with {session.mentor || 'your mentor'}</p>
          </div>
        </div>
        <span className="font-mono text-xs text-black/55 sm:w-52 sm:shrink-0">
          {formatDate(session.date)} · {formatTime(session.time)}
        </span>
        <div className="flex items-center gap-3 sm:ml-auto">
          {session.past && session.status !== 'cancelled' && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-black/40">{filled}/3 notes</span>}
          <Pill>{session.status === 'scheduled' && session.past ? 'Awaiting mentor' : session.status}</Pill>
          {editable && <span className="font-mono text-xs text-orange">{open ? '−' : '+'}</span>}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
            <SessionNotes session={session} onSave={onSave} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function SessionsView({ lp }) {
  const { data, save } = lp
  const upcoming = data.sessions.filter((s) => !s.past)
  const past = data.sessions.filter((s) => s.past)
  const [tab, setTab] = useState(upcoming.length ? 'upcoming' : 'past')
  const [openId, setOpenId] = useState(null)
  const list = tab === 'upcoming' ? upcoming : past

  const saveNotes = (sessionId) => (changes) =>
    save('launchpad/sessions', { session_id: sessionId, ...changes }, (d, r) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.sessionId === r.sessionId ? { ...s, ...r } : s)),
    }))

  return (
    <Page>
      <ViewHeader
        eyebrow="Sessions"
        title={upcoming.length ? `${upcoming.length} upcoming, ${past.length} done.` : `${past.length} sessions so far.`}
        subtitle="Open a past session to add your minutes, deliverables and task updates."
        action={
          <TabBar
            tabs={[
              { id: 'upcoming', label: `Upcoming ${pad2(upcoming.length)}` },
              { id: 'past', label: `Past ${pad2(past.length)}` },
            ]}
            active={tab}
            onChange={setTab}
            layoutId="lp-sessions-tab"
          />
        }
      />
      <div className="mt-10 flex flex-col gap-3">
        {!list.length && <EmptyNote>{tab === 'upcoming' ? 'No upcoming sessions. Your mentor schedules the next one.' : 'No past sessions yet.'}</EmptyNote>}
        {list.map((s, i) => (
          <SessionCard key={s.sessionId} session={s} index={i} open={openId === s.sessionId} onToggle={() => setOpenId((id) => (id === s.sessionId ? null : s.sessionId))} onSave={saveNotes(s.sessionId)} />
        ))}
      </div>
    </Page>
  )
}
