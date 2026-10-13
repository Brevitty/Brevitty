// Startup Junction dashboard data.
// Tabs (row-1 headers, created by scripts/setup-sheets.js; read by header name):
//   StartupProfiles  email | startup_name | team_name | one_liner | description | problem | solution | product | interviews_run
//   Invoices         email | date | customer | amount | note
//   CohortSessions   session_id | date | time | platform | topic | summary | action_item   (cohort-wide)
//   Activity         email | date | kind | title | actor
import { getCachedTab, rowsToObjects, cellToString, cellToISODate } from './sheetsClient.js'
import { istToday, isFlag, fail, cleanText, cleanEnum } from './consulting/rules.js'
import { checkUploaded, removeFile } from './files.js'
import { allRows, rowsFor as storeRowsFor, upsert, warm } from './pillarStore.js'

export const DASHBOARD_TABS = {
  StartupProfiles: ['email', 'startup_name', 'team_name', 'one_liner', 'description', 'problem', 'solution', 'product', 'interviews_run'],
  Invoices: ['email', 'date', 'customer', 'amount', 'note'],
  CohortSessions: ['session_id', 'date', 'time', 'platform', 'topic', 'summary', 'action_item'],
  Activity: ['email', 'date', 'kind', 'title', 'actor'],
}
const ACTIVITY_KINDS = ['document', 'complete', 'session', 'feedback'] // the icons OverviewView knows
const RECENT_ACTIVITY_MAX = 6

const text = (v) => cellToString(v).trim()
const num = (v) => (Number.isFinite(Number(v)) && text(v) !== '' ? Number(v) : 0)
const rowsFor = async (tab, email) => rowsToObjects(await getCachedTab(tab)).filter((r) => text(r.email) === email)
const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// Cohort sessions, upcoming (soonest first) then past (newest first). A session dated today
// still counts as upcoming: the tab has a free-text time, not an end time.
export async function getCohortSessions() {
  const today = istToday()
  const sessions = rowsToObjects(await getCachedTab('CohortSessions'))
    .filter((r) => text(r.session_id))
    .map((r) => {
      const date = cellToISODate(r.date)
      return {
        id: text(r.session_id),
        date,
        time: text(r.time),
        platform: text(r.platform),
        topic: text(r.topic),
        status: date < today ? 'past' : 'upcoming',
        summary: text(r.summary),
        actionItem: text(r.action_item),
      }
    })
  const upcoming = sessions.filter((s) => s.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date))
  const past = sessions.filter((s) => s.status === 'past').sort((a, b) => b.date.localeCompare(a.date))
  return [...upcoming, ...past]
}

async function getProfile(email) {
  const [r] = await rowsFor('StartupProfiles', email)
  if (!r) return null
  return {
    startupName: text(r.startup_name),
    teamName: text(r.team_name) || text(r.startup_name),
    oneLiner: text(r.one_liner),
    description: text(r.description),
    problem: text(r.problem),
    solution: text(r.solution),
    product: text(r.product),
    interviewsRun: num(r.interviews_run),
  }
}

async function getInvoices(email) {
  return (await rowsFor('Invoices', email))
    .map((r) => ({ date: cellToISODate(r.date), customer: text(r.customer), amount: num(r.amount), note: text(r.note) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function getActivity(email) {
  return (await rowsFor('Activity', email))
    .map((r, i) => ({ date: cellToISODate(r.date), kind: text(r.kind), title: text(r.title), actor: text(r.actor), i }))
    .filter((a) => a.title)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_ACTIVITY_MAX)
    .map((a) => ({
      id: `act-${a.i}`,
      kind: ACTIVITY_KINDS.includes(a.kind) ? a.kind : 'session',
      title: a.title,
      actor: a.actor,
      time: a.date ? shortDate(a.date) : '',
    }))
}

// Every tab the Startup Junction workspace reads. Its pages fire several requests at once on load;
// one batchGet fills the shared cache for all of them (see sheetsClient.warmTabs).
const STARTUP_READ_TABS = [
  'StartupProfiles', 'Invoices', 'CohortSessions', 'Activity', 'Competitions', 'CompetitionEntries', 'ItemResources',
  'ChecklistStatus', 'Documents', 'SessionProgress',
]
export const warmStartup = () => warm(STARTUP_READ_TABS)

// Everything the dashboard shell needs in one call. A student with no rows yet gets
// profile: null and empty lists (the UI shows empty states), never a 500.
export async function getDashboard(email) {
  await warmStartup()
  const [profile, invoices, sessions, activity, competitions, resources] = await Promise.all([
    getProfile(email),
    getInvoices(email),
    getCohortSessions(),
    getActivity(email),
    getCompetitions(email),
    getItemResources(),
  ])
  return { profile, invoices, sessions, activity, competitions, resources }
}

/* ---------------- competitions (team-curated catalog + the student's own entries) ---------------- */
// Tabs (created by scripts/setup-sheets.js):
//   Competitions       comp_id | name | org | about | eligibility | event_date | deadline | deadline_note | prize | url | checklist | active
//   CompetitionEntries email | comp_id | status | saved | proof | updated_at       (checklist / proof: one item per line; proof = storage paths)
//   ItemResources      item_id | template_url | example_url                          (journey deliverable help links)
export const COMPETITION_TABS = {
  Competitions: ['comp_id', 'name', 'org', 'about', 'eligibility', 'event_date', 'deadline', 'deadline_note', 'prize', 'url', 'checklist', 'active'],
  CompetitionEntries: ['email', 'comp_id', 'status', 'saved', 'proof', 'updated_at'],
  ItemResources: ['item_id', 'template_url', 'example_url'],
}
export const COMPETITION_STATUSES = ['open', 'applied', 'result', 'closed']
const MAX_PROOF_FILES = 10
const lines = (v) => String(v ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

async function getCompetitions(email) {
  const today = istToday()
  const [catalog, entries] = await Promise.all([allRows('Competitions'), storeRowsFor('CompetitionEntries', email)])
  const mine = new Map(entries.map((e) => [e.comp_id, e]))
  return catalog
    .filter((c) => c.comp_id && c.name && isFlag(c.active))
    .map((c) => {
      const e = mine.get(c.comp_id)
      return {
        id: c.comp_id,
        name: c.name,
        org: c.org,
        about: c.about,
        eligibility: c.eligibility,
        eventDate: c.event_date,
        deadline: c.deadline,
        deadlineNote: c.deadline_note || null,
        prize: c.prize,
        url: safeHttp(c.url),
        checklist: lines(c.checklist),
        // No entry yet: open until the deadline passes.
        status: COMPETITION_STATUSES.includes(e?.status) ? e.status : c.deadline && c.deadline < today ? 'closed' : 'open',
        saved: isFlag(e?.saved),
        proof: lines(e?.proof),
      }
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
}

async function getItemResources() {
  return Object.fromEntries(
    (await allRows('ItemResources'))
      .filter((r) => r.item_id)
      .map((r) => [r.item_id, { template: safeHttp(r.template_url), example: safeHttp(r.example_url) }])
  )
}

// body: { comp_id, status?, saved?, add_proof? (uploaded storage path), remove_proof? (one of mine) }
// -> the refreshed competitions list. A removed proof's file is deleted from storage.
export async function saveCompetition(email, body) {
  const compId = cleanText(body.comp_id, 'comp_id', { required: true, max: 80 })
  const catalog = await allRows('Competitions')
  if (!catalog.some((c) => c.comp_id === compId && isFlag(c.active))) fail(404, 'Competition not found.')
  const changes = { updated_at: istToday() }
  if (body.status !== undefined) changes.status = cleanEnum(body.status, COMPETITION_STATUSES, 'status')
  if (body.saved !== undefined) {
    if (typeof body.saved !== 'boolean') fail(400, 'saved must be true or false.')
    changes.saved = body.saved ? 'TRUE' : ''
  }
  let removed = ''
  if (body.add_proof !== undefined || body.remove_proof !== undefined) {
    const [entry] = (await storeRowsFor('CompetitionEntries', email)).filter((e) => e.comp_id === compId)
    const proof = lines(entry?.proof)
    if (body.add_proof !== undefined) {
      const path = await checkUploaded(email, 'startup', body.add_proof)
      if (proof.length >= MAX_PROOF_FILES) fail(400, `You can add up to ${MAX_PROOF_FILES} proof files per competition.`)
      changes.proof = [...proof.filter((p) => p !== path), path].join('\n')
    } else {
      if (!proof.includes(body.remove_proof)) fail(404, 'Proof not found.')
      removed = body.remove_proof
      changes.proof = proof.filter((p) => p !== removed).join('\n')
    }
  }
  if (Object.keys(changes).length === 1) fail(400, 'Nothing to update.')
  await upsert('CompetitionEntries', { email, comp_id: compId }, changes)
  await removeFile(removed)
  return { competitions: await getCompetitions(email) }
}

const safeHttp = (v) => {
  try {
    return ['http:', 'https:'].includes(new URL(String(v).trim()).protocol) ? String(v).trim() : ''
  } catch {
    return ''
  }
}
