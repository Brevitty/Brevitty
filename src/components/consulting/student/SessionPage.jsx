// One page per session: minutes, tasks and deliverables in three blocks on the same screen.
// Every save shows "Saved" or the server's error right next to its button. The server
// enforces the same rules (own session only; minutes/deliverables once the session is over;
// only sir can change the time).
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, Card, StatusPill, Button, Spinner, NumBadge, inputClass, labelClass, viewItem } from '../ui.jsx'
import { DateBlock, SessionMeta, MomBlock } from '../sessionParts.jsx'
import { TaskItem, DeliverableItem, useSave, SaveStatus } from './parts.jsx'
import { inputBlockedReason } from '../../../lib/consultingTime.js'
import { RescheduleNotice, rescheduleNotice } from './RescheduleNotice.jsx'
import { ACCEPT, FILE_HINT } from '../../../lib/storage.ts'
import { useUpload, UploadProgress, UploadError, FileLink } from '../../hub/FileUpload.jsx'

const UPLOAD_HINT = `Upload the file for each deliverable. ${FILE_HINT}.`

function Block({ n, title, hint, children }) {
  return (
    <motion.section variants={viewItem} className="mt-6">
      <Card className="p-5 sm:p-6">
        <div className="flex items-baseline gap-3">
          <NumBadge n={n} active />
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h2>
        </div>
        {hint && <p className="mt-1 text-sm leading-relaxed text-black/55">{hint}</p>}
        <div className="mt-4">{children}</div>
      </Card>
    </motion.section>
  )
}

// Attachment state: undefined = keep the current one, '' = remove it, a File = upload + replace.
function MinutesForm({ session, blocked, onSave }) {
  const [mom, setMom] = useState(session.mom)
  const [attachment, setAttachment] = useState(undefined)
  const [fileKey, setFileKey] = useState(0) // remounts the file input after a save, clearing its chosen name
  const [state, run, edited] = useSave()
  const { upload, progress, error: uploadError } = useUpload({ pillar: 'consulting', docId: session.session_id })

  if (blocked) return <MomBlock mom={session.mom} link={session.mom_link} />

  const dirty = mom !== session.mom || attachment !== undefined
  const current = attachment === undefined ? session.mom_link : ''
  async function submit(e) {
    e.preventDefault()
    let momFile = attachment === '' ? '' : undefined
    if (attachment instanceof File) {
      const uploaded = await upload(attachment)
      if (!uploaded) return
      momFile = uploaded.path
    }
    run(async () => {
      await onSave(mom.trim(), momFile)
      setAttachment(undefined)
      setFileKey((k) => k + 1)
    })
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="mom-text" className="sr-only">
        Minutes of meeting
      </label>
      <textarea
        id="mom-text"
        rows={7}
        value={mom}
        onChange={(e) => {
          setMom(e.target.value)
          edited()
        }}
        placeholder="What did you discuss, what was decided, and what happens next?"
        className={`${inputClass} min-h-[9rem] resize-y leading-relaxed`}
      />
      <label htmlFor="mom-file" className={`mt-4 block ${labelClass}`}>
        Attachment (optional)
      </label>
      {current && (
        <p className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">
          <FileLink stored={current} />
          <button type="button" onClick={() => { setAttachment(''); edited() }} className="font-mono text-[11px] uppercase tracking-[0.12em] text-black/50 hover:text-red-600">
            Remove
          </button>
        </p>
      )}
      <input
        key={fileKey}
        id="mom-file"
        type="file"
        accept={ACCEPT}
        onChange={(e) => {
          setAttachment(e.target.files?.[0] || undefined)
          edited()
        }}
        className={`mt-1.5 ${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-orange/15 file:px-3 file:py-1 file:text-xs file:font-semibold`}
      />
      <p className="mt-1 text-xs text-black/45">{FILE_HINT}{current ? '. Choosing a file replaces the current one.' : ''}</p>
      <UploadProgress progress={progress} />
      <UploadError error={uploadError} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={state.busy || progress !== null || !mom.trim() || !dirty}>
          {(state.busy || progress !== null) && <Spinner />} Save minutes
        </Button>
        <SaveStatus state={state} />
      </div>
    </form>
  )
}

// "None for this session": one button either way. Marked -> the session stops counting as missing it.
function NoneToggle({ marked, label, onChange }) {
  const [state, run] = useSave()
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-dashed border-black/10 pt-4">
      <Button variant={marked ? 'dark' : 'ghost'} disabled={state.busy} onClick={() => run(() => onChange(!marked))}>
        {state.busy && <Spinner />} {marked ? `✓ ${label} · Undo` : label}
      </Button>
      <SaveStatus state={state} />
    </div>
  )
}

function CancelledBanner({ onRemove }) {
  const [state, run] = useSave()
  return (
    <div role="status" className="mt-5 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
      <p className="text-sm font-semibold text-red-800">This session was cancelled.</p>
      <p className="mt-0.5 text-sm text-red-900/70">It doesn’t count toward anything you owe. Remove it to hide it from your list.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="ghost" disabled={state.busy} onClick={() => run(onRemove)}>
          {state.busy && <Spinner />} Remove session
        </Button>
        <SaveStatus state={state} />
      </div>
    </div>
  )
}

function SessionDetail({ session, actions }) {
  const navigate = useNavigate()
  const blocked = inputBlockedReason(session)
  const cancelled = session.status === 'cancelled'
  const upcoming = blocked && session.status === 'scheduled'
  // Captured once: the notice stays for this visit, then is marked seen so it's gone next time.
  const [notice] = useState(() => rescheduleNotice(session))
  useEffect(() => {
    if (notice) actions.markSeen(session).catch(() => {}) // best effort: worst case the notice shows once more
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Page>
      <motion.div variants={viewItem}>
        <Link to="/consulting/sessions" className="inline-flex min-h-[44px] items-center font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50 hover:text-ink">
          ← All sessions
        </Link>
        <div className="mt-2 flex items-start gap-4">
          <DateBlock date={session.date} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">{session.topic || 'Consulting session'}</h1>
            <div className="mt-1">
              <SessionMeta session={session} />
            </div>
            <div className="mt-2">
              <StatusPill status={session.status} />
            </div>
          </div>
        </div>
        {notice && <RescheduleNotice notice={notice} />}
        {cancelled ? (
          <CancelledBanner
            onRemove={async () => {
              await actions.removeSession(session)
              navigate('/consulting/sessions', { replace: true })
            }}
          />
        ) : (
          blocked && (
            <p className="mt-5 rounded-xl border border-orange/25 bg-orange/[0.06] px-4 py-3 text-sm leading-relaxed text-black/70">
              {upcoming ? 'Minutes and deliverables open once this session ends. You can already tick off tasks.' : blocked}
            </p>
          )
        )}
      </motion.div>

      <Block n={1} title="Minutes of meeting" hint={blocked ? '' : 'Write what was discussed and decided. Attach a file if you have notes or slides.'}>
        <MinutesForm session={session} blocked={Boolean(blocked)} onSave={(mom, momFile) => actions.saveMom(session, mom, momFile)} />
      </Block>

      <Block n={2} title="Tasks" hint={session.tasks.length ? 'Tick a task when it’s done. Add a note if sir should know something.' : ''}>
        {session.tasks.length ? (
          <ul className="divide-y divide-black/[0.06]">
            {session.tasks.map((t) => (
              <TaskItem key={t.task_id} task={t} onUpdate={actions.updateTask} />
            ))}
          </ul>
        ) : (
          <>
            <p className="text-sm text-black/45">{session.no_tasks === 'TRUE' ? 'No tasks for this session.' : 'No tasks set yet.'}</p>
            {!cancelled && (
              <NoneToggle marked={session.no_tasks === 'TRUE'} label="No tasks for this session" onChange={(on) => actions.setFlags(session, { no_tasks: on })} />
            )}
          </>
        )}
      </Block>

      <Block n={3} title="Deliverables" hint={session.deliverables.length && !blocked ? UPLOAD_HINT : ''}>
        {session.deliverables.length ? (
          <ul className="divide-y divide-black/[0.06]">
            {session.deliverables.map((d) => (
              <DeliverableItem key={d.deliverable_id} d={d} blocked={Boolean(blocked)} onSubmit={actions.submitDeliverable} />
            ))}
          </ul>
        ) : (
          <>
            <p className="text-sm text-black/45">{session.no_deliverables === 'TRUE' ? 'No deliverables for this session.' : 'Nothing requested yet.'}</p>
            {!cancelled && (
              <NoneToggle
                marked={session.no_deliverables === 'TRUE'}
                label="No deliverables for this session"
                onChange={(on) => actions.setFlags(session, { no_deliverables: on })}
              />
            )}
          </>
        )}
      </Block>
    </Page>
  )
}

export default function SessionPage({ sessions, ...actions }) {
  const { id } = useParams()
  const session = sessions.find((s) => s.session_id === id)
  if (!session) return <Navigate to="/consulting/sessions" replace />
  return <SessionDetail key={session.session_id} session={session} actions={actions} />
}
