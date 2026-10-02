// Incubation: KPI definitions + formatting. Shared by the client and api/_lib/incubationSheet.js.

// `startupCol` is the INC_Startups column a KPI update also refreshes, so the Overview tiles
// and the KPIs table always agree.
export const KPI_METRICS = [
  { id: 'revenue', label: 'Revenue', unit: 'inr', startupCol: 'revenue', max: 1e11 },
  { id: 'runway', label: 'Runway', unit: 'months', startupCol: 'runway_months', max: 120 },
  { id: 'jobs', label: 'Jobs created', unit: 'count', startupCol: 'jobs_created', max: 100000 },
  { id: 'compliance', label: 'Compliance', unit: 'pct', startupCol: 'compliance_pct', max: 100 },
]
export const KPI_IDS = KPI_METRICS.map((m) => m.id)
export const PERIOD_PATTERN = /^Q[1-4] \d{4}$/

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
  if (unit === 'pct') return `${Math.round(n)}%`
  return String(Math.round(n))
}

export function trendOf(prev, cur) {
  if (!Number.isFinite(prev)) return 'New'
  if (cur > prev) return 'Growing'
  if (cur < prev) return 'Declining'
  return 'Stable'
}

// "Q3 2026" for a YYYY-MM-DD date.
export const quarterOf = (iso) => `Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1} ${iso.slice(0, 4)}`
