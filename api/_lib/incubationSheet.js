// Incubation workspace data. Email is the join key; INC_SchemeList is Hub-wide (team-curated).
// Everything else is entered by the startup itself. Files live in Supabase Storage
// (files.js); the sheet only keeps the file name + storage path.
// Created by scripts/setup-hub-pillars-tabs.mjs.
import { allRows, rowsFor, upsert, warm, newId } from './pillarStore.js'
import { readSheetRows, updateSheetRow, invalidateTab, cellToString, cellToISODate } from './sheetsClient.js'
import { fail, istToday, cleanText, cleanDate, cleanEnum, cleanLink, sameEmail, isFlag } from './consulting/rules.js'
import { checkUploaded, removeFile } from './files.js'
import { fileNameOf } from '../../src/data/fileRules.js'
import {
  KPI_METRICS, PERIOD_PATTERN, periodKey, trendOf, quarterOf, DOC_SLOTS, DOC_KINDS, OTHER_KIND,
  MOU_RENEWAL_YEARS, addYears, FUNDING_TYPES, FUNDING_STATUSES, FUNDING_RECEIVED, SCHEME_STATUSES, STARTUP_STAGES,
} from '../../src/data/incubationRules.js'

export const INC_TABS = {
  INC_Startups: ['email', 'startup', 'founder_name', 'sector', 'stage', 'website', 'updated_at'],
  INC_Documents: ['email', 'id', 'kind', 'title', 'file_name', 'file_path', 'status', 'uploaded_at', 'renewal_date'],
  INC_KPIs: ['email', 'quarter', 'revenue', 'runway_months', 'jobs_created', 'updated_at'],
  INC_Funding: ['email', 'id', 'funder', 'type', 'amount', 'date', 'status', 'notes', 'file_name', 'file_path', 'created_at'],
  INC_SchemeList: ['id', 'name', 'authority', 'description', 'eligibility', 'max_benefit', 'deadline', 'apply_url', 'active'],
  INC_SchemeStatus: ['email', 'scheme_id', 'status', 'updated_at'],
}

const SUBMITTED = 'submitted'
const VERIFIED = 'verified' // only the team sets this, by typing it into the sheet
const MAX_AMOUNT = 1e12
const NEXT_ACTIONS_MAX = 3
const SHEET_LAST_COL_CODE = 64 // 'A' - 1; tabs are read as A:Z so one letter is enough

const num = (v) => (String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
// Cells typed by hand come back as serial numbers; our own writes are ISO text.
const isoDate = (v) => (/^\d{5}$/.test(String(v).trim()) ? cellToISODate(Number(v)) : String(v ?? '').trim())
const safeLink = (v) => {
  try {
    return ['http:', 'https:'].includes(new URL(String(v).trim()).protocol) ? String(v).trim() : ''
  } catch {
    return ''
  }
}

/* ---------------- reads ---------------- */
const docOut = (d) => ({
  id: d.id || d.kind,
  kind: d.kind,
  title: d.title,
  file_name: d.file_name,
  file_path: d.file_path,
  status: d.status.toLowerCase() === VERIFIED ? VERIFIED : SUBMITTED,
  uploaded_at: isoDate(d.uploaded_at),
  renewal_date: d.kind === 'mou' && isoDate(d.uploaded_at) ? addYears(isoDate(d.uploaded_at), MOU_RENEWAL_YEARS) : '',
})

const fundingOut = (f) => ({
  id: f.id, funder: f.funder, type: f.type, amount: num(f.amount), date: isoDate(f.date), status: f.status,
  notes: f.notes, file_name: f.file_name, file_path: f.file_path,
})

function kpisFrom(quarters) {
  return KPI_METRICS.map((m) => {
    const history = quarters.map((q) => ({ period: q.quarter, value: num(q[m.col]) })).filter((h) => h.value !== null)
    const latest = history.at(-1)
    const prev = history.at(-2)
    return { ...m, current: latest?.value ?? null, period: latest?.period || '', trend: latest && prev ? trendOf(prev.value, latest.value) : '', history }
  })
}

const profileOut = (r) => ({ startup: r.startup, founder_name: r.founder_name, sector: r.sector, stage: r.stage, website: r.website })

export async function getIncubation(email) {
  const today = istToday()
  await warm(Object.keys(INC_TABS))
  const [[startup], docRows, kpiRows, fundingRows, schemeRows, statusRows] = await Promise.all([
    rowsFor('INC_Startups', email),
    rowsFor('INC_Documents', email),
    rowsFor('INC_KPIs', email),
    rowsFor('INC_Funding', email),
    allRows('INC_SchemeList'),
    rowsFor('INC_SchemeStatus', email),
  ])

  const documents = docRows.filter((d) => DOC_KINDS.includes(d.kind) && d.file_path && (d.kind !== OTHER_KIND || d.id)).map(docOut)
  const quarters = kpiRows.filter((r) => PERIOD_PATTERN.test(r.quarter)).sort((a, b) => periodKey(a.quarter).localeCompare(periodKey(b.quarter)))
  const kpis = kpisFrom(quarters)
  const latestPeriod = quarters.at(-1)?.quarter || ''
  const thisQuarter = quarterOf(today)
  const funding = fundingRows.filter((f) => f.id).map(fundingOut).sort((a, b) => b.date.localeCompare(a.date))
  const myStatus = new Map(statusRows.map((s) => [s.scheme_id, s.status]))

  const nextActions = []
  if (startup && !documents.some((d) => d.kind === 'mou')) nextActions.push({ label: 'Upload your signed MoU', status: 'Due' })
  if (startup && latestPeriod !== thisQuarter) nextActions.push({ label: `Quarterly KPI update (${thisQuarter})`, status: 'Due' })

  return {
    today,
    thisQuarter,
    startup: startup ? profileOut(startup) : null,
    documents,
    kpis,
    quarters: quarters.map((q) => ({ period: q.quarter, ...Object.fromEntries(KPI_METRICS.map((m) => [m.id, num(q[m.col])])) })),
    funding,
    fundingReceived: funding.filter((f) => f.status === FUNDING_RECEIVED).reduce((sum, f) => sum + (f.amount || 0), 0),
    schemes: schemeRows
      .filter((s) => s.id && s.name && isFlag(s.active))
      .map((s) => ({
        id: s.id, name: s.name, authority: s.authority, description: s.description, eligibility: s.eligibility,
        max_benefit: s.max_benefit, deadline: isoDate(s.deadline), apply_url: safeLink(s.apply_url), my_status: myStatus.get(s.id) || '',
      })),
    nextActions: nextActions.slice(0, NEXT_ACTIONS_MAX),
  }
}

async function requireStartup(email) {
  const [row] = await rowsFor('INC_Startups', email)
  if (!row) fail(404, 'No incubation record for this account yet.')
  return row
}

/* ---------------- profile ---------------- */
// body: { startup, founder_name?, sector?, stage?, website? }. Always the caller's own INC_Startups row;
// the first save creates it (a newly approved founder sets up their own record).
export async function updateProfile(email, body) {
  const stage = body.stage === undefined || body.stage === '' ? '' : cleanEnum(body.stage, STARTUP_STAGES, 'Stage')
  await upsert('INC_Startups', { email }, {
    startup: cleanText(body.startup, 'Startup name', { required: true, max: 120 }),
    founder_name: cleanText(body.founder_name, 'Founder name', { max: 120 }),
    sector: cleanText(body.sector, 'Sector', { max: 80 }),
    stage,
    website: cleanLink(body.website),
    updated_at: istToday(),
  })
  return getIncubation(email)
}

/* ---------------- KPIs ---------------- */
// body: { period: "Q3 2026", values: { revenue, runway, jobs } }. A new quarter needs every value;
// an existing quarter keeps whatever is left blank.
export async function updateKpis(email, body) {
  const period = typeof body.period === 'string' ? body.period.trim() : ''
  if (!PERIOD_PATTERN.test(period)) fail(400, 'Choose a quarter like "Q3 2026".')
  if (periodKey(period) > periodKey(quarterOf(istToday()))) fail(400, 'You can only report a quarter that has started.')
  await requireStartup(email)
  const values = body.values && typeof body.values === 'object' ? body.values : {}
  const [existing] = (await rowsFor('INC_KPIs', email)).filter((r) => r.quarter === period)

  const changes = {}
  for (const m of KPI_METRICS) {
    const raw = typeof values[m.id] === 'string' ? values[m.id].trim() : values[m.id]
    if (raw === undefined || raw === null || raw === '') {
      if (!existing || num(existing[m.col]) === null) fail(400, `${m.label} is required.`)
      continue
    }
    const v = Number(raw)
    if (!Number.isFinite(v) || v < 0 || v > m.max || (m.integer && !Number.isInteger(v))) {
      fail(400, `${m.label} must be a ${m.integer ? 'whole ' : ''}number between 0 and ${m.max}.`)
    }
    changes[m.col] = String(v)
  }
  if (!Object.keys(changes).length) fail(400, 'Enter at least one value to change.')
  await upsert('INC_KPIs', { email, quarter: period }, { ...changes, updated_at: istToday() })
  return getIncubation(email)
}

/* ---------------- files ---------------- */
// The client uploads to storage first (POST /api/files/upload-url), then sends the path here.
// The upload's doc_id is the document kind / 'other' row id / 'funding'.
async function checkedFile(email, body, rowsInUse) {
  const file_path = await checkUploaded(email, 'incubation', body.file_path)
  if (rowsInUse.some((r) => r.file_path === file_path)) fail(409, 'That upload was already saved.')
  return { file_name: cleanText(body.file_name, 'File name', { max: 200 }) || fileNameOf(file_path), file_path }
}

/* ---------------- documents ---------------- */
// body: { kind, title?, id?, file_name, file_path }. Fixed kinds (mou/dpiit/ip) are one row each and
// a new upload replaces the old file; 'other' adds a row (or replaces one when `id` is given).
export async function saveDocument(email, body) {
  const kind = cleanEnum(body.kind, DOC_KINDS, 'kind')
  await requireStartup(email)
  const rows = await rowsFor('INC_Documents', email)
  const isOther = kind === OTHER_KIND
  const existing = rows.find((r) => (isOther ? r.id === body.id && r.kind === OTHER_KIND : r.kind === kind))
  if (isOther && body.id && !existing) fail(404, 'Document not found.')
  const title = isOther ? cleanText(body.title ?? existing?.title, 'Title', { required: true, max: 120 }) : DOC_SLOTS.find((s) => s.kind === kind).title
  const file = await checkedFile(email, body, [...rows, ...(await rowsFor('INC_Funding', email))])

  const today = istToday()
  const id = existing?.id || (isOther ? newId('doc') : kind)
  // Fixed kinds are keyed by kind (a hand-added row may have no id); 'other' rows by id.
  await upsert('INC_Documents', isOther ? { email, id } : { email, kind }, {
    id, kind, title, ...file, status: SUBMITTED, uploaded_at: today,
    renewal_date: '', // computed from uploaded_at on read (3 years), never stored
  })
  await removeFile(existing?.file_path)
  return getIncubation(email)
}

/* ---------------- funding ---------------- */
// body: { id? (edit), funder, type, amount, date, status, notes?, file_name?, file_path? (new proof) }
export async function saveFunding(email, body) {
  await requireStartup(email)
  const rows = await rowsFor('INC_Funding', email)
  const existing = body.id ? rows.find((r) => r.id === body.id) : null
  if (body.id && !existing) fail(404, 'Funding record not found.')
  const amount = Number(typeof body.amount === 'string' ? body.amount.trim() || NaN : body.amount)
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) fail(400, 'Amount must be a number of ₹ (0 or more).')
  const fields = {
    funder: cleanText(body.funder, 'Funder name', { required: true, max: 120 }),
    type: cleanEnum(body.type, FUNDING_TYPES, 'Type'),
    amount: String(amount),
    date: cleanDate(body.date, 'Date received', { required: true }),
    status: cleanEnum(body.status, FUNDING_STATUSES, 'Status'),
    notes: cleanText(body.notes, 'Notes', { max: 500 }),
  }
  const hasNewFile = Boolean(body.file_path)
  const file = hasNewFile ? await checkedFile(email, body, [...rows, ...(await rowsFor('INC_Documents', email))]) : {}
  const id = existing?.id || newId('fund')
  await upsert('INC_Funding', { email, id }, { ...fields, ...file, ...(existing ? {} : { created_at: istToday() }) })
  if (hasNewFile) await removeFile(existing?.file_path)
  return getIncubation(email)
}

// Blanks the row (allRows skips empty rows); the sheet's row numbers never shift under a concurrent write.
export async function deleteFunding(email, { id }) {
  const values = await readSheetRows('INC_Funding')
  const header = (values[0] || []).map((h) => cellToString(h).trim())
  const [iEmail, iId] = [header.indexOf('email'), header.indexOf('id')]
  const at = values.findIndex((r, i) => i > 0 && sameEmail(cellToString(r[iEmail]), email) && cellToString(r[iId]).trim() === String(id))
  if (at < 0) fail(404, 'Funding record not found.')
  const filePath = cellToString(values[at][header.indexOf('file_path')]).trim()
  await updateSheetRow('INC_Funding', at + 1, header.map(() => ''), String.fromCharCode(SHEET_LAST_COL_CODE + header.length))
  invalidateTab('INC_Funding')
  await removeFile(filePath)
  return getIncubation(email)
}

/* ---------------- schemes ---------------- */
export async function setSchemeStatus(email, body) {
  const status = cleanEnum(body.status, SCHEME_STATUSES, 'Status')
  await requireStartup(email)
  const scheme = (await allRows('INC_SchemeList')).find((s) => s.id === body.scheme_id && isFlag(s.active))
  if (!scheme) fail(404, 'Scheme not found.')
  await upsert('INC_SchemeStatus', { email, scheme_id: scheme.id }, { status, updated_at: istToday() })
  return getIncubation(email)
}
