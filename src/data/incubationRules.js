// Incubation: KPI definitions, document/funding/scheme rules + formatting. Shared by the client
// and api/_lib/incubationSheet.js, so the server enforces exactly what the forms promise.

// `col` is the INC_KPIs column the metric lives in. `label` carries the unit (table + form).
export const KPI_METRICS = [
  { id: 'revenue', label: 'Revenue (₹)', unit: 'inr', col: 'revenue', max: 1e11 },
  { id: 'runway', label: 'Runway (months)', unit: 'months', col: 'runway_months', max: 120 },
  { id: 'jobs', label: 'Jobs created', unit: 'count', col: 'jobs_created', max: 100000, integer: true },
]
export const PERIOD_PATTERN = /^Q[1-4] \d{4}$/
export const periodKey = (p) => (PERIOD_PATTERN.test(p) ? `${p.slice(3)}-${p[1]}` : '') // "Q3 2026" -> "2026-3"

/* ---------------- documents ---------------- */
export const DOC_SLOTS = [
  { kind: 'mou', title: 'MoU' },
  { kind: 'dpiit', title: 'DPIIT recognition certificate' },
  { kind: 'ip', title: 'IP documentation' },
]
export const OTHER_KIND = 'other'
export const DOC_KINDS = [...DOC_SLOTS.map((s) => s.kind), OTHER_KIND]
export const MOU_RENEWAL_YEARS = 3

// "No file" is the only state the user ever sees as NOT UPLOADED; VERIFIED is set by the team in the sheet.
export const docStatus = (doc) => (!doc ? 'Not uploaded' : doc.status === 'verified' ? 'Verified' : 'Submitted')

// Same result as Postgres `date + interval '3 years'`: Feb 29 clamps to Feb 28 in a non-leap year.
export function addYears(iso, years) {
  const [y, m, d] = iso.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y + years, m, 0)).getUTCDate()
  return `${y + years}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

/* ---------------- funding + schemes ---------------- */
export const FUNDING_TYPES = ['Grant', 'Equity', 'Loan', 'Other']
export const FUNDING_STATUSES = ['Received', 'Pending', 'Applied']
export const FUNDING_RECEIVED = 'Received'
export const STARTUP_STAGES = ['Idea', 'Prototype', 'MVP', 'Early revenue', 'Scaling']
export const SCHEME_STATUSES = ['Interested', 'Applied', 'Received', 'Not applicable']

/* ---------------- formatting ---------------- */
const LAKH = 1e5
const CRORE = 1e7
const trim1 = (n) => String(Math.round(n * 10) / 10)

export function formatINR(n) {
  if (!Number.isFinite(n)) return '—'
  if (n >= CRORE) return `₹${trim1(n / CRORE)}Cr`
  if (n >= LAKH) return `₹${trim1(n / LAKH)}L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function formatKpi(unit, n) {
  if (!Number.isFinite(n)) return '—'
  if (unit === 'inr') return formatINR(n)
  if (unit === 'months') return `${trim1(n)} mo`
  return String(Math.round(n))
}

// '' when there is no previous quarter to compare against.
export function trendOf(prev, cur) {
  if (!Number.isFinite(prev) || !Number.isFinite(cur)) return ''
  if (cur > prev) return 'Growing'
  if (cur < prev) return 'Declining'
  return 'Stable'
}

// "Q3 2026" for a YYYY-MM-DD date.
export const quarterOf = (iso) => `Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1} ${iso.slice(0, 4)}`
