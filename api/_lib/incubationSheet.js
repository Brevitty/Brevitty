// Incubation workspace data. Email is the join key; INC_Resources is Hub-wide (no email).
// Created + seeded by scripts/setup-hub-pillars-tabs.mjs.
import { allRows, rowsFor, upsert, patchWhere, append } from './pillarStore.js'
import { fail, istToday, cleanText, cleanLink } from './consulting/rules.js'
import { KPI_METRICS, PERIOD_PATTERN, trendOf, quarterOf } from '../../src/data/incubationRules.js'

export const INC_TABS = {
  INC_Startups: ['email', 'startup', 'stage', 'runway_months', 'revenue', 'capital_facilitated', 'compliance_pct', 'jobs_created', 'mou_renewal', 'exit_status', 'exit_review', 'transition_plan'],
  INC_Compliance: ['email', 'item', 'status', 'review_date', 'note'],
  INC_KPIs: ['email', 'metric', 'value', 'trend', 'period'],
  INC_Funding: ['email', 'source', 'stage', 'amount', 'status'],
  INC_Documents: ['email', 'doc', 'type', 'status', 'link'],
  INC_Schemes: ['email', 'scheme', 'relevance', 'status'],
  INC_Media: ['email', 'asset', 'type', 'status'],
  INC_Resources: ['resource', 'format', 'use', 'link'],
}

const NEXT_ACTIONS_MAX = 3
const LOCKED_DOC_STATUSES = ['read-only', 'verified']
const num = (v) => (String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
const periodKey = (p) => (PERIOD_PATTERN.test(p) ? `${p.slice(3)}-${p[1]}` : '') // "Q3 2026" -> "2026-3"
const strip = ({ email, ...rest }) => rest // eslint-disable-line no-unused-vars

function kpisFrom(rows) {
  return KPI_METRICS.map((m) => {
    const history = rows
      .filter((r) => r.metric === m.id && periodKey(r.period))
      .map((r) => ({ period: r.period, value: num(r.value), trend: r.trend }))
      .sort((a, b) => periodKey(a.period).localeCompare(periodKey(b.period)))
    const latest = history.at(-1) || null
    return { ...m, current: latest?.value ?? null, trend: latest?.trend || '', period: latest?.period || '', history }
  })
}

export async function getIncubation(email) {
  const today = istToday()
  const [[startup], compliance, kpiRows, funding, documents, schemes, media, resources] = await Promise.all([
    rowsFor('INC_Startups', email),
    rowsFor('INC_Compliance', email),
    rowsFor('INC_KPIs', email),
    rowsFor('INC_Funding', email),
    rowsFor('INC_Documents', email),
    rowsFor('INC_Schemes', email),
    rowsFor('INC_Media', email),
    allRows('INC_Resources'),
  ])
  const kpis = kpisFrom(kpiRows)
  const latestPeriod = kpis.map((k) => k.period).filter(Boolean).sort((a, b) => periodKey(a).localeCompare(periodKey(b))).at(-1) || ''
  const thisQuarter = quarterOf(today)

  // Upcoming compliance reviews, plus this quarter's KPI update when it hasn't been filed yet.
  const nextActions = compliance
    .filter((c) => c.review_date && c.review_date >= today)
    .sort((a, b) => a.review_date.localeCompare(b.review_date))
    .slice(0, NEXT_ACTIONS_MAX)
    .map((c) => ({ label: `${c.item} review`, date: c.review_date, status: c.status }))
  if (startup && latestPeriod !== thisQuarter) nextActions.unshift({ label: `Quarterly KPI update (${thisQuarter})`, date: '', status: 'Due' })

  return {
    today,
    thisQuarter,
    startup: startup
      ? {
          ...strip(startup),
          runway_months: num(startup.runway_months),
          revenue: num(startup.revenue),
          capital_facilitated: num(startup.capital_facilitated),
          compliance_pct: num(startup.compliance_pct),
          jobs_created: num(startup.jobs_created),
        }
      : null,
    compliance: compliance.map(strip),
    kpis,
    funding: funding.map((f) => ({ ...strip(f), amount: num(f.amount) })),
    documents: documents.map(strip),
    schemes: schemes.map(strip),
    media: media.map(strip),
    resources: resources.filter((r) => r.resource),
    nextActions: nextActions.slice(0, NEXT_ACTIONS_MAX),
  }
}

async function requireStartup(email) {
  const [row] = await rowsFor('INC_Startups', email)
  if (!row) fail(404, 'No incubation record for this account yet.')
  return row
}

// body: { period: "Q4 2026", values: { revenue?, runway?, jobs?, compliance? } }
export async function updateKpis(email, body) {
  const period = typeof body.period === 'string' ? body.period.trim() : ''
  if (!PERIOD_PATTERN.test(period)) fail(400, 'period must look like "Q4 2026".')
  if (periodKey(period) > periodKey(quarterOf(istToday()))) fail(400, 'You can only report a quarter that has started.')
  const values = body.values && typeof body.values === 'object' ? body.values : {}
  const updates = KPI_METRICS.filter((m) => values[m.id] !== undefined && values[m.id] !== '').map((m) => {
    const v = Number(values[m.id])
    if (!Number.isFinite(v) || v < 0 || v > m.max) fail(400, `${m.label} must be a number between 0 and ${m.max}.`)
    return { m, v }
  })
  if (!updates.length) fail(400, 'Enter at least one KPI value.')
  await requireStartup(email)

  const existing = kpisFrom(await rowsFor('INC_KPIs', email))
  const startupChanges = {}
  for (const { m, v } of updates) {
    const history = existing.find((k) => k.id === m.id).history
    const prev = history.filter((h) => periodKey(h.period) < periodKey(period)).at(-1)
    await upsert('INC_KPIs', { email, metric: m.id, period }, { value: String(v), trend: trendOf(prev?.value ?? NaN, v) })
    // Overview tiles show the newest quarter; back-filling an older one must not overwrite them.
    const newest = history.at(-1)
    if (!newest || periodKey(period) >= periodKey(newest.period)) startupChanges[m.startupCol] = String(v)
  }
  if (Object.keys(startupChanges).length) await patchWhere('INC_Startups', { email }, startupChanges)
  return getIncubation(email)
}

// Link-based upload: adds a document row, or replaces the link of one that isn't locked.
export async function addDocument(email, body) {
  const doc = cleanText(body.doc, 'Document name', { required: true, max: 120 })
  const type = cleanText(body.type, 'Type', { max: 60 }) || 'Other'
  const link = cleanLink(body.link, { required: true })
  await requireStartup(email)
  const [existing] = (await rowsFor('INC_Documents', email)).filter((d) => d.doc.toLowerCase() === doc.toLowerCase())
  if (existing && LOCKED_DOC_STATUSES.includes(existing.status.toLowerCase())) fail(409, `"${existing.doc}" is ${existing.status.toLowerCase()} and can't be replaced.`)
  if (existing) await patchWhere('INC_Documents', { email, doc: existing.doc }, { link, status: 'Submitted' })
  else await append('INC_Documents', { email, doc, type, status: 'Submitted', link })
  return { doc, type: existing?.type || type, status: 'Submitted', link }
}
