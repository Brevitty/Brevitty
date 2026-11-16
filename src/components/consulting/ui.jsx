// Shared visual primitives for the consulting workspace (student + admin).
// Theme: Startup Junction's orange/ink/#fafaf8, Space Grotesk headings,
// JetBrains Mono uppercase labels and numerals, the [01] numbered badge.
import { motion } from 'framer-motion'
import { viewContainer, viewItem, ease } from '../junction/dashboard/motionVariants.js'

export { viewContainer, viewItem, ease }

// Small orange text on light surfaces must be #c2410c for AA contrast.
export const ORANGE_TEXT = 'text-[#c2410c]'
export const labelClass = 'font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50'
export const inputClass =
  'block min-h-[44px] w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-black/30 focus:border-orange focus:ring-4 focus:ring-orange/15 disabled:bg-black/[0.03] disabled:text-black/40 sm:text-sm'

export const pad2 = (n) => String(n).padStart(2, '0')

export function NumBadge({ n, active = false, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center font-mono text-[11px] font-semibold tracking-[0.08em] ${
        active ? 'text-orange' : 'text-black/35'
      } ${className}`}
    >
      [{pad2(n)}]
    </span>
  )
}

export function Eyebrow({ children, className = '' }) {
  return <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${ORANGE_TEXT} ${className}`}>{children}</p>
}

// Page header: numbered eyebrow, big display title, optional right-side action.
export function PageHeader({ n, eyebrow, title, subtitle, action }) {
  return (
    <motion.header variants={viewItem} className="flex flex-col gap-4 border-b border-black/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {n !== undefined && <NumBadge n={n} active />}
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink sm:text-[2.6rem]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/55">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.header>
  )
}

export function Page({ children }) {
  return (
    <motion.div
      variants={viewContainer}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-5xl px-4 pb-28 pt-8 sm:px-8 lg:px-12 lg:pb-16 lg:pt-12"
    >
      {children}
    </motion.div>
  )
}

export function Section({ n, title, meta, children, className = '' }) {
  return (
    <motion.section variants={viewItem} className={`mt-10 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          {n !== undefined && <NumBadge n={n} />}
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h2>
        </div>
        {meta && <span className={labelClass}>{meta}</span>}
      </div>
      {children}
    </motion.section>
  )
}

export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`rounded-2xl border border-black/10 bg-white ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

const PILL_TONES = {
  scheduled: 'border-orange/30 bg-orange/10 text-[#c2410c]',
  completed: 'border-ink bg-ink text-white',
  cancelled: 'border-black/10 bg-black/[0.03] text-black/45 line-through decoration-black/30',
  no_show: 'border-red-200 bg-red-50 text-red-700',
  open: 'border-orange/30 bg-orange/10 text-[#c2410c]',
  done: 'border-ink bg-ink text-white',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  pending: 'border-black/15 bg-black/[0.03] text-black/55',
  submitted: 'border-orange/30 bg-orange/10 text-[#c2410c]',
  reviewed: 'border-ink bg-ink text-white',
}
export function StatusPill({ status, label }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
        PILL_TONES[status] || PILL_TONES.pending
      }`}
    >
      {label || status.replace('_', ' ')}
    </span>
  )
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }) {
  const sizes = { sm: 'min-h-[36px] px-3.5 text-xs', md: 'min-h-[44px] px-5 text-sm' }
  const variants = {
    primary:
      'bg-orange text-ink shadow-[0_10px_24px_-12px_rgba(249,115,22,0.8)] hover:bg-[#fb8a3c] focus-visible:ring-orange/40',
    dark: 'bg-ink text-white hover:bg-black/80 focus-visible:ring-black/30',
    ghost: 'border border-black/15 bg-white text-ink hover:border-black/40 focus-visible:ring-black/15',
    danger: 'text-red-700 hover:bg-red-50 focus-visible:ring-red-200',
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold outline-none transition-colors focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Field({ label, htmlFor, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={`${labelClass} block`}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-black/45">{hint}</p>}
    </div>
  )
}

export function Spinner({ className = 'h-4 w-4' }) {
  return <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
}

/* ---------------- designed states ---------------- */

export function LoadingState({ rows = 3, label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-8 lg:px-12 lg:pt-12">
      <div className="h-3 w-28 animate-pulse rounded bg-orange/20" />
      <div className="mt-4 h-9 w-72 max-w-full animate-pulse rounded-lg bg-black/[0.07]" />
      <div className="mt-10 grid gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-black/5 bg-black/[0.035]" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl px-4 pt-16 sm:px-8 lg:px-12">
      <Card className="w-full border-red-200 bg-red-50/40 p-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-red-700">[!!] Couldn’t load this</p>
        <p className="mt-3 max-w-lg font-display text-xl font-bold text-ink">{message}</p>
        {onRetry && (
          <Button variant="dark" className="mt-6" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Card>
    </div>
  )
}

// Inline error line (form saves etc.). Always mounted so layout never jumps.
export function InlineError({ message }) {
  return (
    <p role="alert" className="min-h-[1.25rem] text-sm font-medium text-red-600">
      {message}
    </p>
  )
}

export function EmptyState({ mark = '00', title, body, action }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center">
      <p aria-hidden="true" className="pointer-events-none font-mono text-6xl font-semibold tracking-tight text-black/[0.06]">
        [{mark}]
      </p>
      <p className="mt-2 font-display text-lg font-bold text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-black/55">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

// Big mono stat for the admin "Today" strip and student overview.
export function Stat({ value, label, tone = 'ink', onDark = false }) {
  const toneClass = { orange: 'text-orange', red: onDark ? 'text-red-400' : 'text-red-600', ink: onDark ? 'text-white' : 'text-ink' }[tone]
  return (
    <div>
      <p className={`font-mono text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl ${toneClass}`}>{pad2(value)}</p>
      <p className={`mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${onDark ? 'text-white/45' : 'text-black/50'}`}>{label}</p>
    </div>
  )
}

// Tabs styled as a mono segmented rail (Upcoming / Past etc.).
export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="inline-flex rounded-full border border-black/10 bg-white p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`min-h-[36px] rounded-full px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
            value === t.id ? 'bg-ink text-white' : 'text-black/50 hover:text-ink'
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className={`ml-2 ${value === t.id ? 'text-orange' : 'text-black/30'}`}>{pad2(t.count)}</span>}
        </button>
      ))}
    </div>
  )
}

// Renders the designed loading / error states around a useLoad() result.
export function Loaded({ load, rows, children }) {
  if (load.loading) return <LoadingState rows={rows} />
  if (load.error && !load.data) return <ErrorState message={load.error} onRetry={load.reload} />
  return children(load.data)
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xs text-black/35">
        /
      </span>
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-9`}
      />
    </div>
  )
}
