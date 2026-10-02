import { motion } from 'framer-motion'
import { viewContainer, viewItem, ease } from './motionVariants.js'
import { INCUBATION_DOCUMENTS, FUNDING_DOCUMENTS } from '../../../data/documentsData.js'
import { useJunctionFetch } from '../../../lib/useJunctionFetch.js'
import { CheckIcon } from './icons.jsx'

const eyebrowClass = 'font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange'

const STATUS_COPY = {
  verified: { label: 'Verified', className: 'bg-orange text-white' },
  submitted: {
    label: 'Submitted',
    className: 'border border-orange/30 bg-orange/10 text-[#c2410c] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60',
  },
  not_submitted: { label: 'Not submitted', className: 'border border-black/10 bg-black/[0.03] text-black/45' },
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusPill({ status }) {
  const copy = STATUS_COPY[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wide ${copy.className}`}
    >
      {status === 'verified' && (
        <span className="h-2.5 w-2.5">
          <CheckIcon />
        </span>
      )}
      {copy.label}
    </span>
  )
}

function RequirementTag({ conditional }) {
  return conditional ? (
    <span className="shrink-0 rounded-full border border-orange/30 bg-orange/5 px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-wide text-[#c2410c] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
      Mandatory if applicable
    </span>
  ) : null
}

// `marker` is either a numbered badge (the mandatory sequence) or an
// unnumbered dot (everything optional) — see DocumentsView for why.
function DocumentRow({ doc, marker }) {
  return (
    <motion.div variants={viewItem} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
      <div className="flex items-start gap-4">
        {marker}
        <div>
          <p className="text-sm font-semibold text-ink">{doc.name}</p>
          {doc.date && <p className="mt-0.5 text-xs text-black/45">{formatDate(doc.date)}</p>}
          {doc.conditionNote && <p className="mt-1 max-w-sm text-xs italic leading-relaxed text-black/45">{doc.conditionNote}</p>}
        </div>
      </div>
      <div className="ml-9 flex shrink-0 items-center gap-2.5 sm:ml-0">
        <RequirementTag conditional={doc.conditional} />
        <StatusPill status={doc.status} />
      </div>
    </motion.div>
  )
}

const numberBadge = (i) => (
  <span className="mt-0.5 font-mono text-xs font-semibold text-orange/70">[{String(i + 1).padStart(2, '0')}]</span>
)
// Optional items aren't a sequence to complete in order, so they get a plain
// dot instead of a number — numbering would imply an order that isn't there.
const unnumberedMarker = <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-black/20" />

export default function DocumentsView({ onUnauthorized }) {
  const { loading, error, data } = useJunctionFetch('/api/hub/documents', onUnauthorized)

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-black/40">Loading documents…</p>
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

  const statusFor = (doc) => data?.documents?.[doc.id] || { status: 'not_submitted', date: null }
  const withStatus = (docs) => docs.map((d) => ({ ...d, ...statusFor(d) }))
  const mandatory = withStatus(INCUBATION_DOCUMENTS.filter((d) => d.required))
  const optional = withStatus(INCUBATION_DOCUMENTS.filter((d) => !d.required))
  const funding = withStatus(FUNDING_DOCUMENTS)
  const verifiedCount = mandatory.filter((d) => d.status === 'verified').length
  const pct = mandatory.length ? Math.round((verifiedCount / mandatory.length) * 100) : 0

  return (
    <motion.div variants={viewContainer} initial="hidden" animate="show" className="p-6 lg:p-10">
      <motion.p variants={viewItem} className={eyebrowClass}>
        Documents
      </motion.p>
      <motion.h2 variants={viewItem} className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {verifiedCount} of {mandatory.length} mandatory documents verified.
      </motion.h2>

      <motion.div variants={viewItem} className="mt-6 max-w-md">
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
          {verifiedCount} of {mandatory.length} mandatory documents verified
        </p>
      </motion.div>

      {/* ================= Vertical 1 — Incubation Documents ================= */}
      <motion.div variants={viewItem} className="mt-12">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">Incubation Documents</p>
        <p className="mt-1 text-sm text-black/55">Your admission requirements.</p>

        {/* Mandatory — boxed, bordered in orange, numbered sequence */}
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-orange/25 bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-orange/15 bg-orange/5 px-5 py-4">
            <h3 className="font-display text-lg font-bold text-ink">
              Mandatory <span className="text-[#c2410c]">— {mandatory.length} required</span>
            </h3>
            <p className="text-[11px] text-black/45">Tracked in the meter above</p>
          </div>
          <div className="divide-y divide-orange/10">
            {mandatory.map((doc, i) => (
              <DocumentRow key={doc.id} doc={doc} marker={numberBadge(i)} />
            ))}
          </div>
        </div>

        {/* Optional — separate box, tinted, unnumbered: a different group, not a continuation */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/10 bg-black/[0.03] px-5 py-4">
            <h3 className="font-display text-lg font-bold text-ink">Optional</h3>
            <p className="text-[11px] text-black/45">Doesn't affect the meter above</p>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {optional.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} marker={unnumberedMarker} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* ================= Vertical 2 — Funding & Grants Documents ================= */}
      <motion.div variants={viewItem} className="mt-20 border-t border-black/10 pt-10">
        <div className="rounded-3xl border border-black/10 bg-[#fafaf8] dark:bg-white/[0.04] p-6 sm:p-8">
          <p className={eyebrowClass}>Funding &amp; Grants Documents</p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Only needed if you apply for pre-seed funding or grants.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-black/55">
            A separate, entirely optional set — not part of your incubation requirements.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-surface">
            <div className="divide-y divide-black/[0.06]">
              {funding.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} marker={unnumberedMarker} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
