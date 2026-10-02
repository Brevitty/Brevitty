// Visual primitives for the Launchpad Abroad / Incubation / VAC Learner workspaces. Same
// vocabulary as the Startup Junction dashboard views (bg-surface cards, mono orange eyebrows,
// display headings, [01] badges) and safe in its class-based dark mode: surfaces use
// bg-surface / text-ink / black-alpha tokens, which index.css flips under .dark.
import { motion } from 'framer-motion'
import { viewContainer, viewItem } from '../junction/dashboard/motionVariants.js'

export { viewContainer, viewItem }

export const cardClass = 'rounded-2xl border border-black/10 bg-surface p-6 transition-colors duration-500'
export const eyebrowClass = 'font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45'
export const labelClass = 'font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40'
export const inputClass =
  'block min-h-[44px] w-full rounded-xl border border-black/15 bg-surface px-3.5 py-2.5 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-black/30 focus:border-orange focus:ring-4 focus:ring-orange/15 disabled:opacity-60 sm:text-sm'
// Literal #0a0a0a text on orange: `text-ink` flips to near-white in dark mode, which fails contrast on orange.
export const primaryButton =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-orange px-5 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#fb8a3c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:cursor-not-allowed disabled:opacity-50'
export const ghostButton =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-black/15 px-4 text-sm font-semibold text-ink transition-colors hover:border-orange/50 hover:text-orange disabled:cursor-not-allowed disabled:opacity-50'

export const pad2 = (n) => String(n).padStart(2, '0')

export function Page({ children }) {
  return (
    <motion.div variants={viewContainer} initial="hidden" animate="show" className="p-6 pb-28 lg:p-10">
      {children}
    </motion.div>
  )
}

// Same header as Startup Junction's My Journey / Attendance views.
export function ViewHeader({ eyebrow, title, subtitle, action }) {
  return (
    <motion.div variants={viewItem} className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c] dark:text-orange">{eyebrow}</p>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/55">{subtitle}</p>}
      </div>
      {action}
    </motion.div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <motion.div variants={viewItem} className={`${cardClass} ${className}`}>
      {children}
    </motion.div>
  )
}

export function CardHead({ title, n, action }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={eyebrowClass}>
        {n !== undefined && <span className="mr-2 text-black/30">[{pad2(n)}]</span>}
        {title}
      </span>
      {action}
    </div>
  )
}

export function StatTile({ n, label, value, sub }) {
  return (
    <motion.div variants={viewItem} className={cardClass}>
      <div className="flex items-start justify-between gap-2">
        <span className={eyebrowClass}>{label}</span>
        <span className="font-mono text-[11px] font-semibold text-black/25">[{pad2(n)}]</span>
      </div>
      <p className="mt-5 font-display text-3xl font-bold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-black/50">{sub}</p>}
    </motion.div>
  )
}

export function StatGrid({ children }) {
  return <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}

export function ListRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/[0.06] py-3 last:border-0">
      <span className="text-sm text-black/55">{label}</span>
      <span className="text-right text-sm font-semibold text-ink">{value || '—'}</span>
    </div>
  )
}

/* ---------------- status pills: tone picked from the status word ---------------- */
const TONES = {
  done: 'border-[#0a0a0a] bg-[#0a0a0a] text-white dark:border-white/15',
  active: 'border-orange/30 bg-orange/10 text-[#c2410c] dark:text-orange-soft',
  neutral: 'border-black/15 bg-black/[0.03] text-black/55',
  warn: 'border-red-300/60 bg-red-500/10 text-red-700 dark:text-red-300',
}
const DONE_WORDS = ['verified', 'reviewed', 'published', 'present', 'eligible', 'complete', 'completed', 'done', 'growing', 'on track', 'ready']
const WARN_WORDS = ['absent', 'declining', 'overdue', 'not eligible', 'cancelled', 'missing']
const ACTIVE_WORDS = ['submitted', 'active', 'in progress', 'scheduled', 'meeting', 'term sheet', 'review', 'current', 'due', 'available', 'updated', 'upcoming']
export function toneOf(status) {
  const s = String(status || '').toLowerCase()
  if (WARN_WORDS.some((w) => s.includes(w))) return 'warn'
  if (DONE_WORDS.some((w) => s.startsWith(w) || s === w)) return 'done'
  if (ACTIVE_WORDS.some((w) => s.includes(w))) return 'active'
  return 'neutral'
}
export function Pill({ children, tone }) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${
        TONES[tone || toneOf(children)]
      }`}
    >
      {children}
    </span>
  )
}

/* ---------------- tables: header + bordered rows on desktop, labelled cards on phones ---------------- */
// columns: [{ key, label, width ('1fr' | '140px'...), render?(row) }]
export function DataTable({ columns, rows, rowKey, empty = 'Nothing here yet.', numbered = true }) {
  const template = columns.map((c) => c.width || '1fr').join(' ')
  const grid = 'grid grid-cols-1 gap-1.5 sm:items-center sm:gap-6 sm:[grid-template-columns:var(--cols)]'
  if (!rows.length) return <EmptyNote>{empty}</EmptyNote>
  return (
    <div style={{ '--cols': template }}>
      <div className={`${grid} hidden px-5 sm:grid`}>
        {columns.map((c) => (
          <span key={c.key} className={labelClass}>
            {c.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {rows.map((row, i) => (
          <motion.div key={rowKey(row, i)} variants={viewItem} className={`${grid} rounded-xl border border-black/10 bg-surface px-5 py-4`}>
            {columns.map((c, ci) => (
              <div key={c.key} className="flex min-w-0 items-baseline gap-3 sm:block">
                <span className={`${labelClass} w-28 shrink-0 sm:hidden`}>{c.label}</span>
                <div className="min-w-0 text-sm text-ink">
                  {ci === 0 && numbered && <span className="mr-3 font-mono text-xs font-semibold text-black/30">[{pad2(i + 1)}]</span>}
                  {c.render ? c.render(row) : row[c.key] || '—'}
                </div>
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function EmptyNote({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-black/15 px-5 py-6 text-center text-sm text-black/50">{children}</p>
  )
}

export function LinkOut({ href, children = 'Open' }) {
  if (!href) return <span className="text-black/35">—</span>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#c2410c] underline-offset-4 hover:underline dark:text-orange">
      {children} ↗
    </a>
  )
}

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={`${labelClass} block`}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-black/45">{hint}</p>}
    </div>
  )
}

// Inline save feedback; always mounted so the layout doesn't jump.
export function SaveNote({ state }) {
  const text = state?.error || (state?.saving ? 'Saving…' : state?.saved ? 'Saved to your record.' : '')
  return (
    <p role="status" className={`min-h-[1.25rem] text-xs font-medium ${state?.error ? 'text-red-600 dark:text-red-400' : 'text-black/50'}`}>
      {text}
    </p>
  )
}

export function LoadingView({ label }) {
  return (
    <div className="p-6 lg:p-10">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-black/40">{label}</p>
    </div>
  )
}

export function ErrorView({ message, onRetry }) {
  return (
    <div className="p-6 lg:p-10">
      <p className="text-sm font-medium text-red-500">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${primaryButton} mt-4`}>
          Try again
        </button>
      )}
    </div>
  )
}

// Shown when the signed-in account is approved for the workspace but has no rows in its tabs yet.
export function NoRecordView({ workspace }) {
  return (
    <div className="p-6 lg:p-10">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c] dark:text-orange">{workspace}</p>
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">Your workspace is being set up.</h2>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-black/55">
        The Hub team hasn’t added your {workspace} record yet. Once they do, everything here fills in automatically.
      </p>
    </div>
  )
}
