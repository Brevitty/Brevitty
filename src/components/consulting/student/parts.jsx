// Save-aware building blocks shared by the session page, the Tasks page and the Deliverables page.
// Every save shows "Saved" or the server's error right next to its button.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusPill, Button, Spinner, inputClass, labelClass, ORANGE_TEXT } from '../ui.jsx'
import { isOverdue } from '../sessionParts.jsx'
import { fmtDate } from '../../../lib/consultingTime.js'
import { ACCEPT } from '../../../lib/storage.ts'
import { useUpload, UploadProgress, UploadError, FileLink } from '../../hub/FileUpload.jsx'

export const MAX_NOTE_CHARS = 500
const DELIVERABLE_LABEL = { pending: 'Pending', submitted: 'Submitted', reviewed: 'Reviewed' }

// { busy, saved, error } for one save button. `edited()` clears a stale "Saved" once the user types again.
export function useSave() {
  const [state, setState] = useState({ busy: false, saved: false, error: '' })
  const run = async (fn) => {
    setState({ busy: true, saved: false, error: '' })
    try {
      await fn()
      setState({ busy: false, saved: true, error: '' })
    } catch (err) {
      setState({ busy: false, saved: false, error: err.message })
    }
  }
  const edited = () => setState((s) => (s.saved || s.error ? { busy: false, saved: false, error: '' } : s))
  return [state, run, edited]
}

// Page-level confirmation for lists where the saved row moves to another group (and remounts).
export function SavedBanner({ message }) {
  return (
    <p role="status" aria-live="polite" className={`mt-4 min-h-[1.5rem] text-sm font-semibold text-emerald-700 ${message ? '' : 'invisible'}`}>
      {message ? `✓ ${message}` : '.'}
    </p>
  )
}

export function SaveStatus({ state }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-red-600">
        {state.error}
      </p>
    )
  }
  return (
    <p role="status" className="text-sm font-semibold text-emerald-700">
      {state.saved ? '✓ Saved' : ''}
    </p>
  )
}

const SessionLink = ({ session }) =>
  session ? (
    <Link
      to={`/consulting/sessions/${session.session_id}`}
      className="mt-0.5 inline-flex min-h-[32px] items-center font-mono text-[10px] uppercase tracking-[0.12em] text-black/45 hover:text-ink"
    >
      From {fmtDate(session.date)} · {session.topic || 'Session'} →
    </Link>
  ) : null

// One task: a tick (saves at once, with any note typed so far) and an optional note. `session` adds a "From …" link.
export function TaskItem({ task, session, onUpdate }) {
  const [note, setNote] = useState(task.note)
  const [state, run, edited] = useSave()
  const done = task.status === 'done'
  const noteDirty = note.trim() !== task.note
  const save = (changes) => run(() => onUpdate(task, noteDirty ? { ...changes, note: note.trim() } : changes))

  return (
    <li data-task-id={task.task_id} className="py-4 first:pt-0 last:pb-0">
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          disabled={state.busy}
          onChange={() => save({ status: done ? 'open' : 'done' })}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#f97316]"
        />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${done ? 'text-black/45 line-through decoration-black/25' : 'text-ink'}`}>{task.task}</span>
          <span className={`mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] ${isOverdue(task) ? 'text-red-600' : 'text-black/40'}`}>
            {done
              ? `Done ${fmtDate(task.completed_date)}`
              : task.due_date
                ? `${isOverdue(task) ? 'Overdue · ' : 'Due '}${fmtDate(task.due_date)}`
                : 'No due date'}
          </span>
        </span>
        {state.busy && <Spinner className="mt-1 h-4 w-4 text-black/40" />}
      </label>
      <div className="pl-8">
        <SessionLink session={session} />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label={`Note for: ${task.task}`}
            value={note}
            maxLength={MAX_NOTE_CHARS}
            onChange={(e) => {
              setNote(e.target.value)
              edited()
            }}
            placeholder="Add a short note (optional)"
            className={inputClass}
          />
          {noteDirty && (
            <Button variant="ghost" disabled={state.busy} onClick={() => save({})} className="shrink-0">
              Save note
            </Button>
          )}
        </div>
        <SaveStatus state={state} />
      </div>
    </li>
  )
}

// One deliverable: file + note inline. `blocked` (session not over / cancelled) or a reviewed deliverable is read-only.
// Choosing a new file replaces the old one (deleted server-side); with a file already in, the note can change alone.
export function DeliverableItem({ d, session, blocked, onSubmit }) {
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const [note, setNote] = useState(d.note)
  const [state, run, edited] = useSave()
  const { upload, progress, error: uploadError } = useUpload({ pillar: 'consulting', docId: d.deliverable_id })
  const locked = blocked || d.status === 'reviewed'
  const id = d.deliverable_id

  async function submit(e) {
    e.preventDefault()
    const uploaded = file ? await upload(file) : null
    if (file && !uploaded) return
    run(async () => {
      await onSubmit(d, uploaded?.path, note.trim())
      setFile(null)
      setFileKey((k) => k + 1)
    })
  }

  return (
    <li data-deliverable-id={id} className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-ink">{d.title}</p>
        <StatusPill status={d.status} label={DELIVERABLE_LABEL[d.status]} />
      </div>
      <SessionLink session={session} />
      {locked ? (
        <div className="mt-2 text-sm">
          {d.link ? (
            <FileLink stored={d.link} className={`underline decoration-orange/40 underline-offset-2 ${ORANGE_TEXT}`} />
          ) : (
            <p className="text-black/45">{blocked ? 'Opens once the session has ended.' : 'Nothing submitted.'}</p>
          )}
          {d.note && <p className="mt-1 text-black/60">Note: {d.note}</p>}
        </div>
      ) : (
        <form className="mt-3" onSubmit={submit}>
          {d.link && (
            <p className="mb-2 text-sm">
              <FileLink stored={d.link} className={`underline decoration-orange/40 underline-offset-2 ${ORANGE_TEXT}`} />
            </p>
          )}
          <label htmlFor={`dl-file-${id}`} className={`block ${labelClass}`}>
            {d.link ? 'Replace file (optional)' : 'Your file'}
          </label>
          <input
            key={fileKey}
            id={`dl-file-${id}`}
            type="file"
            accept={ACCEPT}
            required={!d.link}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              edited()
            }}
            className={`mt-1.5 ${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-orange/15 file:px-3 file:py-1 file:text-xs file:font-semibold`}
          />
          <UploadProgress progress={progress} />
          <UploadError error={uploadError} />
          <label htmlFor={`dl-note-${id}`} className={`mt-3 block ${labelClass}`}>
            Note (optional)
          </label>
          <input
            id={`dl-note-${id}`}
            value={note}
            maxLength={MAX_NOTE_CHARS}
            onChange={(e) => {
              setNote(e.target.value)
              edited()
            }}
            placeholder="Anything sir should know"
            className={`mt-1.5 ${inputClass}`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={state.busy || progress !== null || (!file && (!d.link || note.trim() === d.note))}>
              {(state.busy || progress !== null) && <Spinner />} {d.status === 'pending' ? 'Submit' : 'Update'}
            </Button>
            <SaveStatus state={state} />
          </div>
        </form>
      )}
    </li>
  )
}
