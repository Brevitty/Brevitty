// Startup Junction dashboard data that used to be mock constants in src/data/.
// Tabs (row-1 headers, created by scripts/setup-startup-junction-tabs.mjs; read by header name):
//   StartupProfiles  email | startup_name | team_name | one_liner | description | problem | solution | product | interviews_run
//   Invoices         email | date | customer | amount | note
//   MentorSessions   session_id | date | time | platform | mentor | topic | summary | action_item   (cohort-wide)
//   Activity         email | date | kind | title | actor
import { getCachedTab, rowsToObjects, cellToString, cellToISODate } from './sheetsClient.js'
import { istToday } from './consulting/rules.js'

export const DASHBOARD_TABS = {
  StartupProfiles: ['email', 'startup_name', 'team_name', 'one_liner', 'description', 'problem', 'solution', 'product', 'interviews_run'],
  Invoices: ['email', 'date', 'customer', 'amount', 'note'],
  MentorSessions: ['session_id', 'date', 'time', 'platform', 'mentor', 'topic', 'summary', 'action_item'],
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
export async function getMentorSessions() {
  const today = istToday()
  const sessions = rowsToObjects(await getCachedTab('MentorSessions'))
    .filter((r) => text(r.session_id))
    .map((r) => {
      const date = cellToISODate(r.date)
      return {
        id: text(r.session_id),
        date,
        time: text(r.time),
        platform: text(r.platform),
        mentor: text(r.mentor),
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

// Everything the dashboard shell needs in one call. A student with no rows yet gets
// profile: null and empty lists (the UI shows empty states), never a 500.
export async function getDashboard(email) {
  const [profile, invoices, sessions, activity] = await Promise.all([
    getProfile(email),
    getInvoices(email),
    getMentorSessions(),
    getActivity(email),
  ])
  return { profile, invoices, sessions, activity }
}
