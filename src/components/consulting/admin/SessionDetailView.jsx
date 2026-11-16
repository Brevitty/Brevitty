// The consultant's most-used screen: minutes, tasks, deliverables, status and
// reschedule for one session, persisted by a single Save (Ctrl/Cmd+S works too).
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card, Button, Field, InlineError, Spinner, Loaded, NumBadge, StatusPill, Page, inputClass, labelClass, viewItem, ORANGE_TEXT } from '../ui.jsx'
import { DateBlock } from '../sessionParts.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import { admin } from '../../../lib/consultingApi.js'
import { fmtWeekday, fmtDate, fmtRange, fromMin, toMin, relativeDay } from '../../../lib/consultingTime.js'
import { SESSION_STATUSES, TASK_STATUSES, DELIVERABLE_STATUSES, DURATIONS_MIN } from '../../../data/consultingConstants.js'
import SlotPicker, { DurationPicker } from './SlotPicker.jsx'
import { toDraft, isDirty, validate, persist, newTask, newDeliverable } from './sessionDraft.js'
import { paths } from './paths.js'
import { FileLink } from '../../hub/FileUpload.jsx'

const STATUS_LABEL = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' }

function RowShell({ index, children, onRemove, label }) {
  return (
    <div className="group flex items-start gap-3 border-b border-black/[0.06] py-3 last:border-0">
      <NumBadge n={index + 1} className="mt-3.5 w-9" />
      <div className="grid min-w-0 flex-1 gap-2">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black/30 hover:bg-red-50 hover:text-red-600 focus-visible:ring-4 focus-visible:ring-red-100"
      >
        ✕
      </button>
    </div>
  )
}

function RowSelect({ value, options, onChange, label }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} font-mono text-xs uppercase tracking-[0.08em] sm:w-36`}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function Reschedule({ sessionId, value, onChange }) {
  const day = useLoad(() => admin.sessions({ date: value.date }), [value.date])
  const duration = toMin(value.end_time) - toMin(value.start_time)
  const setSlot = (date, start, dur) => onChange({ date, start_time: start, end_time: start ? fromMin(toMin(start) + dur) : value.end_time })
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field label="Date" htmlFor="rs-date" className="sm:w-52">
          <input id="rs-date" type="date" value={value.date} onChange={(e) => e.target.value && setSlot(e.target.value, value.start_time, duration)} className={inputClass} />
        </Field>
        <div>
          <p className={`${labelClass} mb-1.5`}>Duration</p>
          <DurationPicker value={DURATIONS_MIN.includes(duration) ? duration : null} onChange={(d) => setSlot(value.date, value.start_time, d)} />
        </div>
      </div>
      {day.loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-black/[0.04]" />
      ) : day.error ? (
        <p className="text-sm text-red-600">{day.error}</p>
      ) : (
        <SlotPicker
          date={value.date}
          duration={DURATIONS_MIN.includes(duration) ? duration : DURATIONS_MIN[0]}
          sessions={day.data.sessions}
          ignoreId={sessionId}
          value={value.start_time}
          onChange={(start) => setSlot(value.date, start, DURATIONS_MIN.includes(duration) ? duration : DURATIONS_MIN[0])}
        />
      )}
    </div>
  )
}

function Editor({ id, initial }) {
  const [base, setBase] = useState(() => toDraft(initial))
  const [draft, setDraft] = useState(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [rescheduling, setRescheduling] = useState(false)
  const navigate = useNavigate()
  const dirty = isDirty(draft, base)
  const { consultee } = initial
  const s = draft.session

  const setSession = (patch) => setDraft((d) => ({ ...d, session: { ...d.session, ...patch } }))
  const setRow = (list, key, patch) => setDraft((d) => ({ ...d, [list]: d[list].map((r) => (r._key === key ? { ...r, ...patch } : r)) }))
  const addRow = (list, make) => setDraft((d) => ({ ...d, [list]: [...d[list], make()] }))
  const removeRow = (list, key) => setDraft((d) => ({ ...d, [list]: d[list].filter((r) => r._key !== key) }))

  const save = useCallback(
    async (target) => {
      const problem = validate(target)
      if (problem) return setError(problem)
      setSaving(true)
      setError('')
      const result = await persist(id, target, base)
      setBase(result.base)
      setDraft(result.draft)
      setSaving(false)
      if (result.error) setError(result.error)
      else {
        // a cancelled session is hidden server-side from both ends: nothing left to show here
        if (target.session.status === 'cancelled') return navigate(paths.sessions, { replace: true })
        setSavedAt(new Date())
        setRescheduling(false)
      }
    },
    [id, base, navigate]
  )

  // Ctrl/Cmd+S saves; leaving with unsaved minutes asks first.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty && !saving) save(draft)
      }
    }
    const onUnload = (e) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [dirty, saving, save, draft])

  const markCompleted = () => {
    const next = { ...draft, session: { ...draft.session, status: 'completed' } }
    setDraft(next)
    save(next)
  }

  const moved = ['date', 'start_time', 'end_time'].some((k) => s[k] !== base.session[k])
  const removeCancelled = async () => {
    setSaving(true)
    setError('')
    try {
      await admin.removeSession(id)
      navigate(paths.sessions, { replace: true })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }
  // "None needed" checkboxes. Adding a row clears the flag, mirroring the server.
  const NoneCheck = ({ flag, label }) => (
    <label className="mt-3 flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm text-black/70">
      <input type="checkbox" checked={s[flag] === 'TRUE'} onChange={(e) => setSession({ [flag]: e.target.checked ? 'TRUE' : '' })} className="h-4 w-4 accent-[#f97316]" />
      {label}
    </label>
  )

  return (
    <Page>
      <motion.div variants={viewItem} className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link to={paths.sessions} className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45 hover:text-ink">
          ← Sessions
        </Link>
        <span className="text-black/20">/</span>
        <Link to={paths.consultee(consultee.email)} className={`font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${ORANGE_TEXT} hover:underline`}>
          {consultee.name}
        </Link>
      </motion.div>

      {/* header */}
      <motion.header variants={viewItem} className="mt-5 flex flex-col gap-5 border-b border-black/10 pb-7 sm:flex-row sm:items-center">
        <DateBlock date={base.session.date} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={base.session.status} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/45">{relativeDay(base.session.date)}</span>
          </div>
          <input
            aria-label="Topic"
            value={s.topic}
            onChange={(e) => setSession({ topic: e.target.value })}
            placeholder="Add a topic"
            maxLength={200}
            className="mt-2 w-full rounded-lg border border-transparent bg-transparent px-1 py-1 -ml-1 font-display text-2xl font-bold tracking-tight text-ink outline-none placeholder:text-black/25 hover:border-black/10 focus:border-orange focus:bg-white sm:text-3xl"
          />
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-black/50">
            {fmtWeekday(base.session.date)}, {fmtDate(base.session.date)} · {fmtRange(base.session)} IST
            {consultee.startup_name && ` · ${consultee.startup_name}`}
          </p>
        </div>
      </motion.header>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {/* MoM */}
          <motion.section variants={viewItem} className="mt-8">
            <div className="mb-3 flex items-baseline justify-between">
              <label htmlFor="mom" className="flex items-baseline gap-3">
                <NumBadge n={1} active />
                <span className="font-display text-lg font-bold tracking-tight text-ink">Minutes of meeting</span>
              </label>
              <span className={labelClass}>{s.mom.length.toLocaleString()} chars</span>
            </div>
            <textarea
              id="mom"
              value={s.mom}
              onChange={(e) => setSession({ mom: e.target.value })}
              rows={12}
              placeholder={'What was discussed, what was decided, what happens next…\n\nDecisions:\n- …'}
              className="block w-full resize-y rounded-2xl border border-black/10 bg-white p-5 text-[15px] leading-relaxed text-ink shadow-[inset_4px_0_0_#f97316] outline-none placeholder:text-black/25 focus:border-orange focus:ring-4 focus:ring-orange/15"
            />
            {initial.session.mom_link && (
              <p className="mt-2 text-sm">
                <span className={`${labelClass} mr-2`}>Student’s attachment</span>
                <FileLink stored={initial.session.mom_link} className={`font-mono text-[11px] underline underline-offset-2 ${ORANGE_TEXT}`} />
              </p>
            )}
          </motion.section>

          {/* tasks */}
          <motion.section variants={viewItem} className="mt-10">
            <div className="mb-2 flex items-baseline gap-3">
              <NumBadge n={2} active />
              <h2 className="font-display text-lg font-bold tracking-tight text-ink">Tasks</h2>
              <span className={labelClass}>{draft.tasks.length}</span>
            </div>
            <Card className="px-4">
              {draft.tasks.map((t, i) => (
                <RowShell key={t._key} index={i} label="task" onRemove={() => removeRow('tasks', t._key)}>
                  <input aria-label="Task" value={t.task} onChange={(e) => setRow('tasks', t._key, { task: e.target.value })} placeholder="What should they do?" maxLength={200} className={inputClass} />
                  <div className="flex flex-wrap gap-2">
                    <input aria-label="Due date" type="date" value={t.due_date} onChange={(e) => setRow('tasks', t._key, { due_date: e.target.value })} className={`${inputClass} sm:w-44`} />
                    <RowSelect label="Task status" value={t.status} options={TASK_STATUSES} onChange={(v) => setRow('tasks', t._key, { status: v })} />
                  </div>
                </RowShell>
              ))}
              {!draft.tasks.length && <p className="py-4 text-sm text-black/40">No tasks set for this session.</p>}
            </Card>
            {!draft.tasks.length && <NoneCheck flag="no_tasks" label="No tasks for this session" />}
            <button type="button" onClick={() => { addRow('tasks', newTask); if (s.no_tasks) setSession({ no_tasks: '' }) }} className="mt-3 inline-flex min-h-[40px] items-center rounded-full border border-dashed border-black/20 px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55 hover:border-orange hover:text-ink">
              + Add task
            </button>
          </motion.section>

          {/* deliverables */}
          <motion.section variants={viewItem} className="mt-10">
            <div className="mb-2 flex items-baseline gap-3">
              <NumBadge n={3} active />
              <h2 className="font-display text-lg font-bold tracking-tight text-ink">Deliverables</h2>
              <span className={labelClass}>{draft.deliverables.length}</span>
            </div>
            <Card className="px-4">
              {draft.deliverables.map((d, i) => (
                <RowShell key={d._key} index={i} label="deliverable" onRemove={() => removeRow('deliverables', d._key)}>
                  <input aria-label="Deliverable title" value={d.title} onChange={(e) => setRow('deliverables', d._key, { title: e.target.value })} placeholder="Title, e.g. Pitch deck v2" maxLength={200} className={inputClass} />
                  <div className="flex flex-wrap items-center gap-3">
                    <RowSelect label="Deliverable status" value={d.status} options={DELIVERABLE_STATUSES} onChange={(v) => setRow('deliverables', d._key, { status: v })} />
                    {d.link ? (
                      <FileLink stored={d.link} className={`font-mono text-[11px] underline underline-offset-2 ${ORANGE_TEXT}`} />
                    ) : (
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-black/40">{d.deliverable_id ? 'Not uploaded yet' : 'The student uploads the file'}</span>
                    )}
                  </div>
                </RowShell>
              ))}
              {!draft.deliverables.length && <p className="py-4 text-sm text-black/40">No deliverables for this session.</p>}
            </Card>
            {!draft.deliverables.length && <NoneCheck flag="no_deliverables" label="No deliverables for this session" />}
            <button type="button" onClick={() => { addRow('deliverables', newDeliverable); if (s.no_deliverables) setSession({ no_deliverables: '' }) }} className="mt-3 inline-flex min-h-[40px] items-center rounded-full border border-dashed border-black/20 px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55 hover:border-orange hover:text-ink">
              + Add deliverable
            </button>
          </motion.section>

          {/* reschedule */}
          <motion.section variants={viewItem} className="mt-10">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <NumBadge n={4} active />
                <h2 className="font-display text-lg font-bold tracking-tight text-ink">Time</h2>
              </div>
              {!rescheduling && (
                <Button size="sm" variant="ghost" onClick={() => setRescheduling(true)}>
                  Reschedule
                </Button>
              )}
            </div>
            {rescheduling ? (
              <Card className="p-5">
                <Reschedule sessionId={id} value={s} onChange={(slot) => setSession(slot)} />
                <button
                  type="button"
                  onClick={() => {
                    setSession({ date: base.session.date, start_time: base.session.start_time, end_time: base.session.end_time })
                    setRescheduling(false)
                  }}
                  className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-black/45 hover:text-ink"
                >
                  Keep original time
                </button>
              </Card>
            ) : (
              <p className="text-sm text-black/55">
                {fmtWeekday(base.session.date)}, {fmtDate(base.session.date)} · {fmtRange(base.session)} IST
              </p>
            )}
          </motion.section>
        </div>

        {/* control rail */}
        <motion.aside variants={viewItem} className="lg:sticky lg:top-8 lg:mt-8 lg:self-start">
          <Card className="overflow-hidden border-ink">
            <div className="bg-ink px-5 py-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-orange">Session status</p>
            </div>
            <div role="radiogroup" aria-label="Session status" className="grid grid-cols-2 gap-2 p-4">
              {SESSION_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={s.status === st}
                  onClick={() => setSession({ status: st })}
                  className={`min-h-[40px] rounded-xl border font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    s.status === st ? 'border-ink bg-ink text-white' : 'border-black/10 text-black/55 hover:border-black/30 hover:text-ink'
                  }`}
                >
                  {STATUS_LABEL[st]}
                </button>
              ))}
            </div>
            <div className="space-y-2 border-t border-dashed border-black/15 p-4">
              <Button className="w-full" disabled={!dirty || saving} onClick={() => save(draft)}>
                {saving ? (
                  <>
                    <Spinner /> Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              {base.session.status === 'cancelled' && (
                <Button variant="danger" className="w-full" disabled={saving} onClick={removeCancelled}>
                  Remove cancelled session
                </Button>
              )}
              {base.session.status !== 'completed' && (
                <Button variant="dark" className="w-full" disabled={saving} onClick={markCompleted}>
                  ✓ Mark completed
                </Button>
              )}
              <p className="pt-1 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-black/40">
                {saving ? 'Writing to the sheet…' : dirty ? (moved ? 'Unsaved · new time' : 'Unsaved changes') : savedAt ? `Saved ${savedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'All saved · Ctrl+S'}
              </p>
              <InlineError message={error} />
            </div>
          </Card>
        </motion.aside>
      </div>
    </Page>
  )
}

export default function SessionDetailView() {
  const { id } = useParams()
  const load = useLoad(() => admin.session(id), [id])
  return (
    <Loaded load={load} rows={4}>
      {(data) => <Editor key={id} id={id} initial={data} />}
    </Loaded>
  )
}
