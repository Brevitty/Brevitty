// Partner Services workspace data (institutional / ecosystem partners). Email is the join key:
// the signed-in email is the partner account. Created + seeded by scripts/setup-hub-pillars-tabs.mjs.
import { rowsFor, patchWhere } from './pillarStore.js'
import { fail, istToday, cleanText, cleanEmail, cleanLink } from './consulting/rules.js'

export const PS_TABS = {
  PS_Partners: ['email', 'org_name', 'university', 'org_type', 'contact_name', 'contact_email', 'contact_phone', 'representatives', 'financial_commitment', 'mou_ref', 'linked_startups'],
  PS_Programs: ['email', 'program', 'type', 'status', 'participants'],
  PS_Disbursements: ['email', 'program', 'amount', 'period', 'status'],
  PS_Reports: ['email', 'report', 'period', 'status', 'due_date', 'link'],
  PS_Events: ['email', 'date', 'event', 'participants', 'status'],
  PS_Contacts: ['email', 'contact', 'role', 'contact_email', 'status'],
  PS_Renewals: ['email', 'partnership', 'renewal_date', 'status'],
  PS_MoU: ['email', 'document', 'reference', 'status'],
}

export const ORG_TYPES = ['Academic institution', 'Government', 'Corporate', 'PSU', 'Other']
const SUBMITTED = 'Submitted'
const PHONE_PATTERN = /^[+0-9 ()-]{7,20}$/
const NEXT_ACTIONS_MAX = 4
const num = (v) => (String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
const strip = ({ email, ...rest }) => rest // eslint-disable-line no-unused-vars
// "Q3 FY26" -> 2603, "H1 FY26" -> 2601 (halves sort with their first quarter); unknown -> -1
const periodKey = (p) => {
  const m = /^([QH])(\d) FY(\d{2})$/.exec(String(p).trim())
  return m ? Number(m[3]) * 100 + (m[1] === 'H' ? (Number(m[2]) - 1) * 2 + 1 : Number(m[2])) : -1
}
const isSubmitted = (r) => r.status.toLowerCase() === SUBMITTED.toLowerCase()

export async function getPartner(email) {
  const today = istToday()
  const [[partner], programs, disbursementRows, reports, events, contacts, renewals, mou] = await Promise.all(
    Object.keys(PS_TABS).map((t) => rowsFor(t, email))
  )
  const disbursements = disbursementRows.map((d) => ({ ...strip(d), amount: num(d.amount) }))
  // "This cycle" = the newest period that has disbursements.
  const cycle = disbursements.map((d) => d.period).sort((a, b) => periodKey(b) - periodKey(a))[0] || ''
  const due = reports.filter((r) => !isSubmitted(r)).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const upcoming = renewals.filter((r) => r.renewal_date >= today).sort((a, b) => a.renewal_date.localeCompare(b.renewal_date))

  const nextActions = [
    ...due.map((r) => ({ label: `${r.report} (${r.period})`, date: r.due_date, overdue: Boolean(r.due_date) && r.due_date < today })),
    ...upcoming.map((r) => ({ label: `${r.partnership} renewal · ${r.status}`, date: r.renewal_date, overdue: false })),
  ].slice(0, NEXT_ACTIONS_MAX)

  return {
    today,
    partner: partner ? { ...strip(partner), linked_startups: num(partner.linked_startups) } : null,
    programs: programs.map(strip),
    disbursements,
    reports: reports.map(strip),
    events: events.map(strip).sort((a, b) => a.date.localeCompare(b.date)),
    contacts: contacts.map(strip),
    renewals: renewals.map(strip).sort((a, b) => a.renewal_date.localeCompare(b.renewal_date)),
    mou: mou.map(strip),
    summary: {
      programs: programs.length,
      activePrograms: programs.filter((p) => p.status.toLowerCase() === 'active').length,
      cycle,
      fundsThisCycle: disbursements.filter((d) => d.period === cycle).reduce((s, d) => s + (d.amount || 0), 0),
      fundsTotal: disbursements.reduce((s, d) => s + (d.amount || 0), 0),
      reportsDue: due.length,
      nextReportDue: due[0]?.due_date || '',
      renewalsUpcoming: upcoming.length,
      nextRenewal: upcoming[0]?.renewal_date || '',
    },
    nextActions,
  }
}

async function requirePartner(email) {
  const [row] = await rowsFor('PS_Partners', email)
  if (!row) fail(404, 'No partner record for this account yet.')
  return row
}

// body: { report, period, link } -> that report (own rows only) becomes Submitted with the link.
export async function submitReport(email, body) {
  const report = cleanText(body.report, 'report', { required: true, max: 120 })
  const period = cleanText(body.period, 'period', { required: true, max: 20 })
  const link = cleanLink(body.link, { required: true })
  await requirePartner(email)
  const row = await patchWhere('PS_Reports', { email, report, period }, { status: SUBMITTED, link })
  if (!row) fail(404, 'Report not found.')
  return { report, period, status: SUBMITTED, link, due_date: row.due_date }
}

// body: { contact_name, contact_email, contact_phone } -> the partner record's primary contact.
export async function updateContact(email, body) {
  const changes = {
    contact_name: cleanText(body.contact_name, 'Contact name', { required: true, max: 120 }),
    contact_email: cleanEmail(body.contact_email),
    contact_phone: cleanText(body.contact_phone, 'Contact phone', { required: true, max: 20 }),
  }
  if (!PHONE_PATTERN.test(changes.contact_phone)) fail(400, 'Contact phone may only contain digits, spaces, +, - and brackets.')
  await requirePartner(email)
  await patchWhere('PS_Partners', { email }, changes)
  return changes
}
