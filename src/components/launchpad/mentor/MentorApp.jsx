import { useState } from 'react'
import { motion } from 'framer-motion'
import { useJunctionFetch } from '../../../lib/useJunctionFetch.js'
import { hubPost, formatDate, formatTime, istTodayISO } from '../../../lib/hubApi.js'
import { PHASES, PROFILE_SECTIONS, DOCUMENTS, deriveLaunchpad, allPhasesDone, profileReadySeal } from '../../../data/launchpadChecklist.js'
import { StageRail, AttendanceMeter } from '../../junction/dashboard/shared.jsx'
import { CheckIcon, UsersIcon } from '../../junction/dashboard/icons.jsx'
import PillarDashboard from '../../hub/PillarDashboard.jsx'
import {
  Page, ViewHeader, Pill, ListRow, LinkOut, Field, SaveNote, EmptyNote, LoadingView, ErrorView,
  cardClass, eyebrowClass, inputClass, primaryButton, ghostButton, viewItem, pad2,
} from '../../hub/ui.jsx'

const NAV_ITEMS = [{ id: 'students', label: 'Students', icon: UsersIcon }]
// Bookable mentor slots, IST: every 30 minutes from 15:00 to 19:30.
const SLOT_FIRST_MIN = 15 * 60
const SLOT_LAST_MIN = 19 * 60 + 30
const SLOT_STEP_MIN = 30
const SLOTS = Array.from({ length: (SLOT_LAST_MIN - SLOT_FIRST_MIN) / SLOT_STEP_MIN + 1 }, (_, i) => {
  const m = SLOT_FIRST_MIN + i * SLOT_STEP_MIN
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})

// Launchpad Abroad mentor view (/launchpad/mentor). Access = the signed-in email is a
// contact_email in LP_Mentors (checked server-side on every call).
export default function MentorApp({ email, onSignOut, onUnauthorized }) {
  const list = useJunctionFetch('/api/hub/launchpad/mentor', onUnauthorized)
  const [selected, setSelected] = useState(null)

  const renderView = () => {
    if (list.loading && !list.data) return <LoadingView label="Loading your students…" />
    if (list.error && !list.data) return <ErrorView message={list.error} onRetry={list.refetch} />
    if (selected) {
      return (
        <StudentDetail
          email={selected}
          onBack={() => {
            setSelected(null)
            list.refetch()
          }}
          onUnauthorized={onUnauthorized}
        />
      )
    }
    return <StudentList data={list.data} onOpen={setSelected} />
  }

  return (
    <PillarDashboard
      workspaceLabel="Launchpad Abroad · Mentor"
      navItems={NAV_ITEMS}
      teamName={list.data?.mentor?.name || 'Mentor'}
      email={email}
      onSignOut={onSignOut}
      onUnauthorized={onUnauthorized}
      renderView={renderView}
    />
  )
}

function StudentList({ data, onOpen }) {
  const { mentor, students } = data
  const [filter, setFilter] = useState('mine')
  const shown = filter === 'mine' ? students.filter((s) => s.mine) : students
  return (
    <Page>
      <ViewHeader
        eyebrow={`Mentor · ${mentor.name}`}
        title={`${students.filter((s) => s.mine).length} students assigned to you.`}
        subtitle="Open a student to see their journey, profile, documents and sessions, and to leave feedback, schedule, verify or sign off."
        action={
          <div className="inline-flex rounded-full border border-black/10 bg-black/[0.03] p-1">
            {[['mine', 'Mine'], ['all', 'All students']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-full px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] ${filter === id ? 'bg-[#0a0a0a] text-white' : 'text-black/50 hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div className="mt-10 hidden gap-6 px-5 sm:flex">
        {['Student', 'Grade', 'Current phase', 'Profile', 'Status'].map((h, i) => (
          <span key={h} className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40 ${['w-72 shrink-0', 'w-14 shrink-0', 'w-36 shrink-0', 'w-40 shrink-0', 'ml-auto'][i]}`}>
            {h}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {!shown.length && <EmptyNote>No students here yet.</EmptyNote>}
        {shown.map((s, i) => (
          <motion.button
            key={s.email}
            type="button"
            variants={viewItem}
            onClick={() => onOpen(s.email)}
            className="flex flex-col gap-3 rounded-xl border border-black/10 bg-surface px-5 py-4 text-left transition-colors hover:border-orange/50 sm:flex-row sm:items-center sm:gap-6"
          >
            <div className="flex items-center gap-4 sm:w-72 sm:shrink-0">
              <span className="font-mono text-xs font-semibold text-black/30">[{pad2(i + 1)}]</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                <p className="truncate text-xs text-black/45">{s.school}</p>
              </div>
            </div>
            <span className="font-mono text-xs text-black/60 sm:w-14 sm:shrink-0">Gr {s.grade}</span>
            <span className="text-sm text-ink sm:w-36 sm:shrink-0">
              <span className="mr-1.5 font-mono text-xs text-orange">{s.phaseN}</span>
              {s.phase}
            </span>
            <AttendanceMeter presentCount={s.completeness} heldCount={100} caption="profile complete" className="w-full sm:w-40 sm:shrink-0" />
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {s.profileReady && <Pill tone="done">Profile Ready</Pill>}
              {s.awaitingVerification > 0 && <Pill tone="active">{`${s.awaitingVerification} to verify`}</Pill>}
              {!s.profileReady && !s.awaitingVerification && <Pill tone="neutral">On track</Pill>}
            </div>
          </motion.button>
        ))}
      </div>
    </Page>
  )
}

function useAction(onUnauthorized, after) {
  const [state, setState] = useState(null)
  const run = async (path, body) => {
    setState({ saving: true })
    try {
      await hubPost(path, body)
      setState({ saved: true })
      after()
      return true
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      setState({ error: err.message })
      return false
    }
  }
  return [state, run]
}

function StudentDetail({ email, onBack, onUnauthorized }) {
  const load = useJunctionFetch(`/api/hub/launchpad/mentor/student?email=${encodeURIComponent(email)}`, onUnauthorized)
  if (load.loading && !load.data) return <LoadingView label="Loading student…" />
  if (load.error && !load.data) return <ErrorView message={load.error} onRetry={load.refetch} />
  return <StudentWorkspace data={load.data} onBack={onBack} refetch={load.refetch} onUnauthorized={onUnauthorized} />
}

function StudentWorkspace({ data, onBack, refetch, onUnauthorized }) {
  const { student } = data
  const { phases, current, completeness, profileReady } = deriveLaunchpad(data)
  const byDoc = Object.fromEntries(data.documents.map((d) => [d.docId, d]))

  return (
    <Page>
      <motion.button variants={viewItem} type="button" onClick={onBack} className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45 hover:text-orange">
        ← All students
      </motion.button>
      <div className="mt-6">
        <ViewHeader
          eyebrow={`Grade ${student.grade} · ${student.school}`}
          title={student.name}
          subtitle={`${current ? `Phase ${current.n} — ${current.label}` : 'All four phases complete'} · profile ${completeness.pct}% complete`}
        />
      </div>

      <motion.div variants={viewItem} className={`${cardClass} mt-8`}>
        <span className={eyebrowClass}>Journey</span>
        <StageRail stages={phases} seal={profileReadySeal(phases, profileReady, data.signoff)} />
      </motion.div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SignOffCard student={student} phases={phases} profileReady={profileReady} signoff={data.signoff} onDone={refetch} onUnauthorized={onUnauthorized} />
        <FeedbackCard student={student} feedback={data.feedback} onDone={refetch} onUnauthorized={onUnauthorized} />
        <ScheduleCard student={student} onDone={refetch} onUnauthorized={onUnauthorized} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <motion.div variants={viewItem} className={cardClass}>
          <span className={eyebrowClass}>Checklist</span>
          <div className="mt-4 space-y-5">
            {PHASES.map((p) => (
              <div key={p.id}>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
                  [{p.n}] {p.label} · {phases.find((x) => x.id === p.id).completion.doneCount}/{phases.find((x) => x.id === p.id).completion.totalCount} compulsory
                </p>
                <ul className="mt-2 space-y-1.5">
                  {p.items.map((it) => (
                    <li key={it.id} className="flex items-start gap-2.5 text-sm">
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${data.checked[it.id] ? 'border-orange bg-orange text-white' : 'border-black/20 text-transparent'}`}>
                        <span className="h-2.5 w-2.5">
                          <CheckIcon />
                        </span>
                      </span>
                      <span className={data.checked[it.id] ? 'text-ink' : 'text-black/50'}>
                        {it.label}
                        {!it.required && <span className="ml-1.5 text-xs text-black/35">(optional)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={viewItem} className={cardClass}>
          <span className={eyebrowClass}>Profile</span>
          <div className="mt-2">
            <ListRow label="Guardian" value={`${student.guardian.name} · ${student.guardian.contact}`} />
            <ListRow label="Guardian consent" value={student.guardian.consent ? 'Given' : 'Pending'} />
            {PROFILE_SECTIONS.flatMap((s) => s.fields.filter((f) => f.source !== 'student').map((f) => ({ s, f }))).map(({ s, f }) => (
              <div key={`${s.id}.${f.id}`} className="border-b border-black/[0.06] py-3 last:border-0">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
                  {s.title} · {f.label}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink">
                  {f.kind === 'link' && data.profile[`${s.id}.${f.id}`] ? <LinkOut href={data.profile[`${s.id}.${f.id}`]} /> : data.profile[`${s.id}.${f.id}`] || <span className="text-black/35">Not added</span>}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div variants={viewItem} className={`${cardClass} mt-5`}>
        <span className={eyebrowClass}>Documents</span>
        <div className="mt-4 flex flex-col">
          {DOCUMENTS.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} row={byDoc[doc.id]} studentEmail={student.email} onDone={refetch} onUnauthorized={onUnauthorized} />
          ))}
        </div>
      </motion.div>

      <motion.div variants={viewItem} className={`${cardClass} mt-5`}>
        <span className={eyebrowClass}>Sessions</span>
        <div className="mt-4 space-y-3">
          {!data.sessions.length && <p className="text-sm text-black/55">No sessions yet.</p>}
          {data.sessions.map((s) => (
            <div key={s.sessionId} className="rounded-xl border border-black/10 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-black/60">
                  {formatDate(s.date)} · {formatTime(s.time)} · {s.mentor}
                </span>
                <Pill>{s.status === 'scheduled' && s.past ? 'Awaiting update' : s.status}</Pill>
              </div>
              {['mom', 'deliverables', 'tasks'].map((k) =>
                s[k] ? (
                  <p key={k} className="mt-2 text-sm text-black/70">
                    <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.12em] text-black/40">{k === 'mom' ? 'MoM' : k}</span>
                    {s[k]}
                  </p>
                ) : null
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </Page>
  )
}

function DocumentRow({ doc, row, studentEmail, onDone, onUnauthorized }) {
  const [state, run] = useAction(onUnauthorized, onDone)
  const status = row?.status || 'pending'
  return (
    <div className="flex flex-col gap-2 border-b border-black/[0.06] py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-sm font-semibold text-ink sm:w-56 sm:shrink-0">{doc.name}</span>
      <span className="font-mono text-xs text-black/50 sm:w-28">{row?.submittedDate ? formatDate(row.submittedDate) : '—'}</span>
      <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
        {row?.link && <LinkOut href={row.link}>View</LinkOut>}
        <Pill tone={status === 'verified' ? 'done' : status === 'submitted' ? 'active' : 'neutral'}>{status}</Pill>
        {status === 'submitted' && (
          <button type="button" disabled={state?.saving} onClick={() => run('launchpad/mentor/verify', { email: studentEmail, doc_id: doc.id })} className={ghostButton}>
            Verify
          </button>
        )}
        {state?.error && <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>}
      </div>
    </div>
  )
}

function SignOffCard({ student, phases, profileReady, signoff, onDone, onUnauthorized }) {
  const [state, run] = useAction(onUnauthorized, onDone)
  const ready = allPhasesDone(phases)
  return (
    <motion.div variants={viewItem} className="rounded-2xl bg-[#0a0a0a] p-6 text-white dark:bg-gradient-to-br dark:from-[#1c1512] dark:to-[#241a12]">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Profile Ready</span>
      <h3 className="mt-3 font-display text-xl font-bold">
        {profileReady ? `Signed off by ${signoff.signedBy}` : ready ? 'All four phases done. Ready for your sign-off.' : 'Unlocks when Phase 4 is complete.'}
      </h3>
      <p className="mt-2 text-sm text-white/55">
        {profileReady ? formatDate(signoff.date) : `${phases.filter((p) => p.status === 'done').length} of ${phases.length} phases complete.`}
      </p>
      {!profileReady && (
        <button type="button" disabled={!ready || state?.saving} onClick={() => run('launchpad/mentor/signoff', { email: student.email })} className={`${primaryButton} mt-5`}>
          Mark Profile Ready
        </button>
      )}
      {state?.error && <p className="mt-2 text-xs text-red-300">{state.error}</p>}
    </motion.div>
  )
}

function FeedbackCard({ student, feedback, onDone, onUnauthorized }) {
  const [text, setText] = useState('')
  const [state, run] = useAction(onUnauthorized, onDone)
  async function submit(e) {
    e.preventDefault()
    if (await run('launchpad/mentor/feedback', { email: student.email, feedback: text.trim() })) setText('')
  }
  return (
    <motion.form variants={viewItem} onSubmit={submit} className={cardClass}>
      <span className={eyebrowClass}>Leave feedback</span>
      <div className="mt-4">
        <Field label="Feedback" htmlFor="mentor-feedback">
          <textarea id="mentor-feedback" rows={3} maxLength={1000} required value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!text.trim() || state?.saving} className={primaryButton}>
          Send feedback
        </button>
        <SaveNote state={state} />
      </div>
      {feedback[0] && <p className="mt-3 text-xs text-black/45">Last: “{feedback[0].feedback}” · {formatDate(feedback[0].date)}</p>}
    </motion.form>
  )
}

function ScheduleCard({ student, onDone, onUnauthorized }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState(SLOTS[4])
  const [state, run] = useAction(onUnauthorized, onDone)
  async function submit(e) {
    e.preventDefault()
    if (await run('launchpad/mentor/schedule', { email: student.email, date, time })) setDate('')
  }
  return (
    <motion.form variants={viewItem} onSubmit={submit} className={cardClass}>
      <span className={eyebrowClass}>Schedule a session</span>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="mentor-date">
          <input id="mentor-date" type="date" required min={istTodayISO()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Time (IST)" htmlFor="mentor-time">
          <select id="mentor-time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass}>
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {formatTime(s).replace(' IST', '')}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!date || state?.saving} className={primaryButton}>
          Schedule
        </button>
        <SaveNote state={state} />
      </div>
    </motion.form>
  )
}
