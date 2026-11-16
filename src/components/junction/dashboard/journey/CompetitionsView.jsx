import { useState } from 'react'
import { CheckIcon } from '../icons.jsx'
import { FileUploadButton } from '../../../hub/FileUpload.jsx'
import { fileHref, fileNameOf } from '../../../../lib/storage.ts'

const eyebrowClass = 'font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'applied', label: 'Applied' },
  { id: 'result', label: 'Result' },
  { id: 'closed', label: 'Closed' },
]

const STATUS_STYLE = {
  open: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  applied: 'border-orange/30 bg-orange/10 text-[#c2410c]',
  result: 'border-black/10 bg-[#0a0a0a] text-white',
  closed: 'border-black/10 bg-black/[0.03] text-black/45',
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round">
      <path d="M12 3.5 14.9 9.4 21.5 10.4 16.7 15 17.9 21.5 12 18.3 6.1 21.5 7.3 15 2.5 10.4 9.1 9.4Z" />
    </svg>
  )
}

function CompetitionCard({ competition, onSave }) {
  const [error, setError] = useState('')
  // onSave applies the change at once and rejects (after restoring the old value) if the server refuses it.
  const patch = async (fields) => {
    setError('')
    try {
      await onSave(competition.id, fields)
      return true
    } catch (err) {
      setError(err.message || 'Could not save that change.')
      return false
    }
  }
  const addProof = async ({ path }) => {
    await patch({ add_proof: path })
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-bold text-ink">{competition.name}</h3>
            <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide ${STATUS_STYLE[competition.status]}`}>
              {competition.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-black/45">{competition.org}</p>
        </div>
        <button
          type="button"
          onClick={() => patch({ saved: !competition.saved })}
          aria-label={competition.saved ? 'Unsave competition' : 'Save competition'}
          className={`h-6 w-6 shrink-0 transition-colors ${competition.saved ? 'text-orange' : 'text-black/25 hover:text-orange'}`}
        >
          <StarIcon filled={competition.saved} />
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-black/60">{competition.about}</p>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-4 sm:grid-cols-4">
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/40">Eligibility</dt>
          <dd className="mt-1 text-xs leading-relaxed text-black/60">{competition.eligibility}</dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/40">Event</dt>
          <dd className="mt-1 text-xs leading-relaxed text-black/60">{competition.eventDate}</dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/40">Deadline</dt>
          <dd className="mt-1 text-xs leading-relaxed text-black/60">{formatDate(competition.deadline)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/40">Prize</dt>
          <dd className="mt-1 text-xs leading-relaxed text-black/60">{competition.prize}</dd>
        </div>
      </dl>

      {competition.deadlineNote && (
        <p className="mt-3 text-[11px] italic leading-relaxed text-black/40">{competition.deadlineNote}</p>
      )}

      <div className="mt-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/40">Applying involves</p>
        <ul className="mt-2 space-y-1.5">
          {competition.checklist.map((c) => (
            <li key={c} className="flex gap-2 text-xs text-black/55">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.06] pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/40" htmlFor={`status-${competition.id}`}>
            Status
          </label>
          <select
            id={`status-${competition.id}`}
            value={competition.status}
            onChange={(e) => patch({ status: e.target.value })}
            className="rounded-full border border-black/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink outline-none focus-visible:border-orange"
          >
            {['open', 'applied', 'result', 'closed'].map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <a
            href={competition.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-orange transition-opacity hover:opacity-70"
          >
            Official site ↗
          </a>
        </div>

        <div className="flex min-w-0 flex-wrap items-start gap-2">
          {competition.proof.map((f) => (
            <span key={f} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] py-1 pl-2.5 pr-1 font-mono text-[10px] text-black/55">
              <span className="h-3 w-3 shrink-0">
                <CheckIcon />
              </span>
              <a href={fileHref(f)} target="_blank" rel="noopener noreferrer" className="truncate hover:text-orange">
                {fileNameOf(f)}
              </a>
              <button type="button" onClick={() => patch({ remove_proof: f })} aria-label={`Remove proof ${fileNameOf(f)}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-black/40 hover:bg-red-50 hover:text-red-600">
                ✕
              </button>
            </span>
          ))}
          <FileUploadButton
            target={{ pillar: 'startup', docId: competition.id }}
            label="+ Add proof"
            ariaLabel={`Add proof for ${competition.name}`}
            className="text-xs font-semibold text-black/45 transition-colors hover:text-orange disabled:opacity-60"
            onUploaded={addProof}
          />
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-500">{error}</p>}
    </div>
  )
}

export default function CompetitionsView({ competitions, onSave }) {
  const [filter, setFilter] = useState('all')
  const visible = filter === 'all' ? competitions : competitions.filter((c) => c.status === filter)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className={eyebrowClass}>Competitions</span>
        <div className="inline-flex flex-wrap gap-1 rounded-full border border-black/10 bg-black/[0.03] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                filter === f.id ? 'bg-[#0a0a0a] text-white' : 'text-black/50 hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {visible.length === 0 ? (
          <p className="rounded-xl border border-black/10 bg-black/[0.03] px-4 py-4 text-sm text-black/55">
            {competitions.length ? 'No competitions in this filter. Try another one.' : 'No competitions are listed yet. The Hub team publishes them here; once they do, save the ones you want and track each application.'}
          </p>
        ) : (
          visible.map((c) => <CompetitionCard key={c.id} competition={c} onSave={onSave} />)
        )}
      </div>
    </div>
  )
}
