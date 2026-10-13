// Hub Admin: every number on every admin page is COMPUTED here from the real tabs. Nothing is
// stored, nothing is hardcoded. `buildModel(db, now)` is pure (scripts/check-hub-admin.mjs asserts
// on it); `loadDb()` is the only I/O. Reads go through the shared 30s tab cache, warmed with ONE
// batchGet. The only writes are user management (Students tab + a Consultees row for new
// consulting users).
import crypto from 'crypto'
import { allRows, append, patchWhere, warm } from './pillarStore.js'
import { list as consultingList, insert as consultingInsert } from './consulting/store.js'
import { fail, istToday, addDays, sameEmail, cleanEmail, cleanText } from './consulting/rules.js'
import { isArchived, sirItems, studentItems } from './consulting/missing.js'
import { membershipsOf, invalidateRoster } from './roster.js'
import { isDemoEmail, isEnvAdmin, withoutDemo } from './accounts.js'
import { progressRows } from './launchpadSheet.js'
import { PILLARS, MEMBERSHIP_STATUSES } from '../../src/data/hubPillars.js'
import { INACTIVE_AFTER_DAYS } from '../../src/data/consultingConstants.js'
import { certificateStatus, ASSIGNMENT_DONE } from '../../src/data/vacRules.js'
import { addYears, MOU_RENEWAL_YEARS, PERIOD_PATTERN, periodKey, quarterOf, FUNDING_RECEIVED } from '../../src/data/incubationRules.js'
import { getDefaultChecklistState, getStagesWithStatus, getInvoiceTotal, hasVerifiedCompetitionEntry } from '../../src/data/journeyData.js'

/* ---------------- at-risk rules (named, so the dashboards and the check script agree) ---------------- */
export const MOU_RENEWAL_WARN_DAYS = 60
const MOU_RENEWAL_HIGH_DAYS = 30
const LP_STALL_DAYS = 30
const OVERDUE_TASKS_HIGH = 3
const MISSING_UPDATES_HIGH = 2
const WEEK_DAYS = 7
const MS_PER_DAY = 86_400_000
const PASSWORD_MIN = 6
const PASSWORD_MAX = 128
const GENERATED_PASSWORD_LEN = 10
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_FIELD_CHARS = 200
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 }

export const STUDENTS_TAB = process.env.GOOGLE_SHEET_TAB?.trim() || 'Students'
const USER_PILLARS = PILLARS.filter((p) => !p.adminOnly)
const GRANTABLE_PILLARS = USER_PILLARS.filter((p) => p.id !== 'consulting') // consulting access = a Consultees row (Consulting admin)
const titleOf = (id) => PILLARS.find((p) => p.id === id)?.title ?? id

const lc = (v) => String(v ?? '').trim().toLowerCase()
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY)
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null)
const num = (v) => (String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0)
const group = (rows, key = (r) => lc(r.email)) => {
  const m = new Map()
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) || []), r])
  return (k) => m.get(lc(k)) || []
}

/* ---------------- I/O ---------------- */
const ALLROWS_TABS = {
  students: STUDENTS_TAB, cohortSessions: 'CohortSessions',
  checklist: 'ChecklistStatus', invoices: 'Invoices', profiles: 'StartupProfiles', competitionEntries: 'CompetitionEntries',
  lpStudents: 'LP_Students', lpChecklist: 'LP_Checklist', lpProfile: 'LP_Profile', lpDocuments: 'LP_Documents', lpSessions: 'LP_Sessions',
  lpSignoff: 'LP_Signoff', incStartups: 'INC_Startups', incDocuments: 'INC_Documents', incKpis: 'INC_KPIs', incFunding: 'INC_Funding',
  vacLearners: 'VAC_Learners', vacSessions: 'VAC_Sessions', vacAssignments: 'VAC_Assignments',
}
const CONSULTING_TABS = { consultees: 'Consultees', admins: 'Admins', sessions: 'ConsultingSessions', tasks: 'Tasks', deliverables: 'Deliverables' }

// Admins only ever see real users: every row belonging to a demo account (accounts.js) is dropped
// here, before anything is computed, and so are class sessions only demo learners attend.
export function realOnly(db) {
  const out = Object.fromEntries(Object.entries(db).map(([k, rows]) => [k, withoutDemo(rows)]))
  const same = (a, b) => lc(a) === lc(b)
  out.vacSessions = out.vacSessions.filter((s) => out.vacLearners.some((l) => same(s.course, l.course) && (!s.batch || same(s.batch, l.batch))))
  return out
}

export async function loadDb() {
  await warm([...Object.values(ALLROWS_TABS), ...Object.values(CONSULTING_TABS)])
  const entries = await Promise.all([
    ...Object.entries(ALLROWS_TABS).map(async ([k, tab]) => [k, await allRows(tab)]),
    ...Object.entries(CONSULTING_TABS).map(async ([k, tab]) => [k, await consultingList(tab)]),
  ])
  return realOnly(Object.fromEntries(entries))
}

/* ---------------- users ---------------- */
// One entry per email across every tab, with the memberships exactly as sign-in resolves them
// (consulting access comes from the Consultees tab, never from a Students cell).
function usersOf(db) {
  const byEmail = new Map()
  const touch = (email, name = '') => {
    const k = lc(email)
    if (!k) return null
    if (!byEmail.has(k)) byEmail.set(k, { email: String(email).trim(), name: '', role: 'member', login: false, startup: '', memberships: {} })
    const u = byEmail.get(k)
    if (name && !u.name) u.name = name
    return u
  }
  for (const s of db.students) {
    const u = touch(s.email, s.name)
    u.login = true
    for (const m of membershipsOf(s.memberships)) if (m.pillar !== 'consulting' && m.pillar !== 'admin') u.memberships[m.pillar] = m.status
    if (isEnvAdmin(s.email)) u.role = 'admin' // ADMIN_EMAILS
  }
  for (const c of db.consultees) {
    const u = touch(c.email, c.name)
    u.login = true
    u.memberships.consulting = 'approved'
    u.startup ||= c.startup_name
  }
  for (const a of db.admins) {
    const u = touch(a.email, a.name)
    u.login = true
    u.role = 'admin'
  }
  for (const r of db.lpStudents) touch(r.email, r.name)
  for (const r of db.incStartups) (touch(r.email, r.founder_name).startup ||= r.startup)
  for (const r of db.vacLearners) touch(r.email, r.name)
  for (const p of db.profiles) (touch(p.email).startup ||= p.startup_name)
  return [...byEmail.values()].sort((a, b) => (a.role === 'admin' ? -1 : 0) - (b.role === 'admin' ? -1 : 0) || a.name.localeCompare(b.name) || a.email.localeCompare(b.email))
}

const approved = (u, pillar) => u.memberships[pillar] === 'approved'

/* ---------------- per-pillar computed facts (shared by flags and reports) ---------------- */
function consultingFacts(db, now, today) {
  const sessionsOf = group(db.sessions.filter((s) => !isArchived(s)))
  const tasksOf = group(db.tasks)
  const deliverablesOf = group(db.deliverables)
  const cutoff = addDays(today, -INACTIVE_AFTER_DAYS)
  return db.consultees.map((c) => {
    const sessions = sessionsOf(c.email).map((s) => ({
      ...s,
      tasks: tasksOf(c.email).filter((t) => t.session_id === s.session_id),
      deliverables: deliverablesOf(c.email).filter((d) => d.session_id === s.session_id),
    }))
    const live = sessions.filter((s) => s.status !== 'cancelled')
    const sir = live.flatMap((s) => sirItems(s, now))
    const mine = tasksOf(c.email).filter((t) => live.some((s) => s.session_id === t.session_id))
    return {
      consultee: c,
      sessions: live,
      held: live.filter((s) => s.date < today || s.status === 'completed').length,
      withMom: live.filter((s) => s.mom).length,
      missingMom: sir.filter((i) => i.kind === 'mom').length,
      missingTasks: sir.filter((i) => i.kind === 'tasks').length,
      missingDeliverables: sir.filter((i) => i.kind === 'deliverables').length,
      studentOwes: live.flatMap((s) => studentItems(s, now)).length,
      tasksTotal: mine.length,
      tasksDone: mine.filter((t) => t.status === 'done').length,
      overdueTasks: mine.filter((t) => t.status === 'open' && t.due_date && t.due_date < today).length,
      deliverablesTotal: deliverablesOf(c.email).length,
      deliverablesSubmitted: deliverablesOf(c.email).filter((d) => d.status !== 'pending').length,
      upcoming: live.filter((s) => s.status === 'scheduled' && s.date >= today),
      inactive: !live.some((s) => s.date >= cutoff),
    }
  })
}

function startupFacts(db) {
  const checklistOf = group(db.checklist)
  const invoicesOf = group(db.invoices)
  const entriesOf = group(db.competitionEntries)
  return (u) => {
    const state = { ...getDefaultChecklistState() }
    for (const r of checklistOf(u.email)) if (lc(r.checked) === 'true' && r.item_id in state) state[r.item_id] = true
    const ledger = getInvoiceTotal(invoicesOf(u.email).map((i) => ({ amount: num(i.amount) })))
    const verified = hasVerifiedCompetitionEntry(entriesOf(u.email).map((e) => ({ status: e.status, proof: String(e.proof || '').split('\n').filter(Boolean) })))
    const stages = getStagesWithStatus(state, ledger, verified)
    const stage = stages.find((s) => s.status === 'current')
    const itemsDone = Object.values(state).filter(Boolean).length
    return {
      stage: stage ? stage.label : stages.at(-1).label,
      stagesDone: stages.filter((s) => s.status === 'done').length,
      itemsDone,
      itemsTotal: Object.keys(state).length,
    }
  }
}

function incubationFacts(db, today) {
  const docsOf = group(db.incDocuments)
  const kpisOf = group(db.incKpis)
  const fundingOf = group(db.incFunding)
  const thisQuarter = quarterOf(today)
  return db.incStartups.map((s) => {
    const mou = docsOf(s.email).find((d) => d.kind === 'mou' && d.file_path)
    const uploaded = mou?.uploaded_at || ''
    const renewal = uploaded ? addYears(uploaded, MOU_RENEWAL_YEARS) : ''
    const quarters = kpisOf(s.email).filter((r) => PERIOD_PATTERN.test(r.quarter)).sort((a, b) => periodKey(a.quarter).localeCompare(periodKey(b.quarter)))
    const latest = quarters.at(-1)
    return {
      startup: s,
      mouUploaded: uploaded,
      mouRenewal: renewal,
      mouDays: renewal ? daysBetween(today, renewal) : null,
      latestQuarter: latest?.quarter || '',
      kpiCurrent: latest?.quarter === thisQuarter,
      revenue: latest ? num(latest.revenue) : null,
      runway: latest ? num(latest.runway_months) : null,
      jobs: latest ? num(latest.jobs_created) : null,
      fundingReceived: fundingOf(s.email).filter((f) => f.id && f.status === FUNDING_RECEIVED).reduce((sum, f) => sum + num(f.amount), 0),
      thisQuarter,
    }
  })
}

function vacFacts(db, today) {
  const assignmentsOf = group(db.vacAssignments)
  return db.vacLearners.map((l) => {
    const assignments = assignmentsOf(l.email).map((a) => ({ ...a, status: lc(a.status) || 'pending' }))
    return {
      learner: l,
      certificate: certificateStatus(assignments),
      overdue: assignments.filter((a) => a.due && a.due < today && !ASSIGNMENT_DONE.includes(a.status)).length,
    }
  })
}

/* ---------------- flags ---------------- */
const flag = (u, pillar, kind, severity, title, detail) => ({
  id: `${pillar}:${kind}:${lc(u.email)}`, email: u.email, name: u.name || u.email, pillar, pillarTitle: titleOf(pillar), kind, severity, title, detail,
})
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function buildFlags({ users, consulting, incubation, vac, lp, today }) {
  const byEmail = new Map(users.map((u) => [lc(u.email), u]))
  const userOf = (email) => byEmail.get(lc(email)) ?? { email, name: '' }
  const flags = []

  for (const f of consulting) {
    const u = userOf(f.consultee.email)
    const missing = f.missingMom + f.missingTasks + f.missingDeliverables
    if (missing) {
      const parts = [
        f.missingMom && `${plural(f.missingMom, 'session')} without MoM`,
        f.missingDeliverables && `${plural(f.missingDeliverables, 'session')} without deliverables`,
        f.missingTasks && `${plural(f.missingTasks, 'session')} without tasks`,
      ].filter(Boolean)
      flags.push(flag(u, 'consulting', 'missing_updates', f.missingMom + f.missingDeliverables >= MISSING_UPDATES_HIGH ? 'high' : 'medium', 'Missing MoM / deliverables', parts.join(' · ')))
    }
    if (f.overdueTasks) flags.push(flag(u, 'consulting', 'overdue_tasks', f.overdueTasks >= OVERDUE_TASKS_HIGH ? 'high' : 'medium', 'Overdue tasks', `${plural(f.overdueTasks, 'open task')} past due`))
    if (f.inactive) flags.push(flag(u, 'consulting', 'inactive', 'low', 'No recent session', `No session in the last ${INACTIVE_AFTER_DAYS} days and none booked`))
  }

  for (const f of incubation) {
    const u = userOf(f.startup.email)
    if (!f.mouUploaded) flags.push(flag(u, 'incubation', 'mou_missing', 'medium', 'MoU not uploaded', 'No signed MoU on file'))
    else if (f.mouDays <= MOU_RENEWAL_WARN_DAYS) {
      flags.push(flag(u, 'incubation', 'mou_renewal', f.mouDays <= MOU_RENEWAL_HIGH_DAYS ? 'high' : 'medium', 'MoU renewal due', f.mouDays < 0 ? `Renewal date ${f.mouRenewal} passed ${plural(-f.mouDays, 'day')} ago` : `Renews ${f.mouRenewal} (in ${plural(f.mouDays, 'day')})`))
    }
    if (!f.kpiCurrent) flags.push(flag(u, 'incubation', 'kpi_stale', 'low', 'KPI update due', f.latestQuarter ? `Last reported ${f.latestQuarter}; ${f.thisQuarter} not reported yet` : 'No KPIs reported yet'))
  }

  for (const f of vac) {
    const u = userOf(f.learner.email)
    if (f.overdue) flags.push(flag(u, 'vac', 'overdue_assignments', f.overdue >= OVERDUE_TASKS_HIGH ? 'high' : 'medium', 'Overdue assignments', `${plural(f.overdue, 'assignment')} past due`))
  }

  for (const s of lp) {
    const u = userOf(s.email)
    if (!s.profileReady && s.lastActivity && daysBetween(s.lastActivity, today) > LP_STALL_DAYS) {
      flags.push(flag(u, 'launchpad', 'stalled', 'medium', 'No progress', `Nothing ticked since ${s.lastActivity}; still in ${s.phase}`))
    }
    if (s.awaitingVerification) flags.push(flag(u, 'launchpad', 'docs_waiting', 'low', 'Documents awaiting verification', `${plural(s.awaitingVerification, 'document')} submitted, not yet verified`))
  }

  return flags.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind))
}

/* ---------------- workload ---------------- */
function buildWorkload({ db, consulting, lp, vac, today }) {
  const weekEnd = addDays(today, WEEK_DAYS)
  const rows = []

  rows.push({
    team: 'Consulting',
    name: 'Consulting desk',
    students: consulting.length,
    upcoming: consulting.reduce((n, f) => n + f.upcoming.filter((s) => s.date <= weekEnd).length, 0),
    pending: consulting.reduce((n, f) => n + f.missingMom + f.missingTasks + f.missingDeliverables, 0),
    overdue: consulting.reduce((n, f) => n + f.overdueTasks, 0),
    note: 'Pending = past sessions still missing MoM, tasks or deliverables',
  })

  rows.push({
    team: 'Startup Junction',
    name: 'Startup Junction cohort',
    students: db.students.filter((u) => membershipsOf(u.memberships).some((m) => m.pillar === 'startup' && m.status === 'approved')).length,
    upcoming: db.cohortSessions.filter((s) => s.session_id && s.date >= today && s.date <= weekEnd).length,
    pending: db.cohortSessions.filter((s) => s.session_id && s.date < today && !String(s.summary || '').trim()).length,
    overdue: 0,
    note: 'Pending = held sessions with no summary logged',
  })

  rows.push({
    team: 'Launchpad Abroad',
    name: 'Launchpad team',
    students: lp.length,
    upcoming: db.lpSessions.filter((s) => s.status !== 'cancelled' && s.date >= today && s.date <= weekEnd).length,
    pending: lp.reduce((n, s) => n + s.awaitingVerification, 0) + lp.filter((s) => s.phasesDone === 4 && !s.profileReady).length,
    overdue: 0,
    note: 'Pending = documents to verify + sign-offs waiting',
  })

  const facultyOf = group(vac, (r) => lc(r.learner.faculty))
  for (const faculty of [...new Set(vac.map((v) => v.learner.faculty).filter(Boolean))]) {
    const mine = facultyOf(faculty)
    const courses = new Set(mine.map((v) => lc(v.learner.course)))
    rows.push({
      team: 'VAC Learner',
      name: faculty,
      students: mine.length,
      upcoming: db.vacSessions.filter((s) => courses.has(lc(s.course)) && s.date >= today && s.date <= weekEnd).length,
      pending: mine.filter((v) => v.certificate.totalAssignments > 0 && !v.certificate.eligible).length,
      overdue: mine.reduce((n, v) => n + v.overdue, 0),
      note: 'Pending = learners not yet eligible for the certificate',
    })
  }
  return rows.sort((a, b) => b.pending + b.overdue - (a.pending + a.overdue) || b.students - a.students)
}

/* ---------------- reports ---------------- */
const col = (key, label) => ({ key, label })
function buildReports({ users, consulting, startup, incubation, vac, lp }) {
  const member = users.filter((u) => u.role === 'member')
  const money = (n) => (n === null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`)
  return [
    {
      id: 'membership',
      title: 'Membership by workspace',
      columns: [col('workspace', 'Workspace'), col('approved', 'Approved'), col('pending', 'Pending'), col('rejected', 'Rejected')],
      rows: USER_PILLARS.map((p) => ({
        workspace: p.title,
        approved: member.filter((u) => u.memberships[p.id] === 'approved').length,
        pending: member.filter((u) => u.memberships[p.id] === 'pending').length,
        rejected: member.filter((u) => u.memberships[p.id] === 'rejected').length,
      })),
    },
    {
      id: 'consulting',
      title: 'Consulting: sessions, MoM, tasks and deliverables',
      columns: [col('name', 'Student'), col('startup', 'Startup'), col('held', 'Sessions held'), col('momPct', 'MoM filed'), col('tasks', 'Tasks done'), col('deliverables', 'Deliverables in'), col('missing', 'Missing items')],
      rows: consulting.map((f) => ({
        name: f.consultee.name,
        startup: f.consultee.startup_name || '—',
        held: f.held,
        momPct: f.held ? `${pct(f.withMom, f.held)}%` : '—',
        tasks: `${f.tasksDone}/${f.tasksTotal}`,
        deliverables: `${f.deliverablesSubmitted}/${f.deliverablesTotal}`,
        missing: f.missingMom + f.missingTasks + f.missingDeliverables,
      })),
    },
    {
      id: 'startup',
      title: 'Startup Junction: journey stage',
      columns: [col('name', 'Founder'), col('startup', 'Startup'), col('stage', 'Current stage'), col('items', 'Checklist items')],
      rows: users.filter((u) => approved(u, 'startup')).map((u) => {
        const f = startup(u)
        return { name: u.name || u.email, startup: u.startup || '—', stage: f.stage, items: `${f.itemsDone}/${f.itemsTotal}` }
      }),
    },
    {
      id: 'launchpad',
      title: 'Launchpad Abroad: phase and profile',
      columns: [col('name', 'Student'), col('grade', 'Grade'), col('phase', 'Current phase'), col('profile', 'Profile complete'), col('ready', 'Profile Ready'), col('docs', 'Docs to verify')],
      rows: lp.map((s) => ({ name: s.name, grade: s.grade, phase: s.phase, profile: `${s.completeness}%`, ready: s.profileReady ? 'Yes' : 'No', docs: s.awaitingVerification })),
    },
    {
      id: 'incubation',
      title: 'Incubation: KPIs, funding and MoU',
      columns: [col('startup', 'Startup'), col('quarter', 'Latest quarter'), col('revenue', 'Revenue'), col('runway', 'Runway (months)'), col('jobs', 'Jobs'), col('funding', 'Funding received'), col('renewal', 'MoU renewal')],
      rows: incubation.map((f) => ({ startup: f.startup.startup, quarter: f.latestQuarter || '—', revenue: money(f.revenue), runway: f.runway ?? '—', jobs: f.jobs ?? '—', funding: money(f.fundingReceived), renewal: f.mouRenewal || 'No MoU' })),
    },
    {
      id: 'vac',
      title: 'VAC Learner: assignments and certificate',
      columns: [col('name', 'Learner'), col('course', 'Course'), col('assignments', 'Assignments done'), col('certificate', 'Certificate')],
      rows: vac.map((f) => ({
        name: f.learner.name,
        course: f.learner.course,
        assignments: `${f.certificate.done}/${f.certificate.totalAssignments}`,
        certificate: f.certificate.eligible ? 'Eligible' : 'Not yet',
      })),
    },
  ]
}

/* ---------------- the model ---------------- */
export function buildModel(db, now = Date.now()) {
  const today = istToday(new Date(now))
  const users = usersOf(db)
  const consulting = consultingFacts(db, now, today)
  const startup = startupFacts(db)
  const incubation = incubationFacts(db, today)
  const vac = vacFacts(db, today)
  const lp = progressRows({ students: db.lpStudents, checklist: db.lpChecklist, profile: db.lpProfile, documents: db.lpDocuments, signoff: db.lpSignoff })
  const ctx = { users, db, consulting, startup, incubation, vac, lp, today }

  const flags = buildFlags(ctx)
  const workload = buildWorkload(ctx)
  const reports = buildReports(ctx)

  const member = users.filter((u) => u.role === 'member')
  const flaggedEmails = new Set(flags.map((f) => lc(f.email)))
  const highEmails = new Set(flags.filter((f) => f.severity === 'high').map((f) => lc(f.email)))
  const weekEnd = addDays(today, WEEK_DAYS)
  const upcomingThisWeek = {
    consulting: consulting.reduce((n, f) => n + f.upcoming.filter((s) => s.date <= weekEnd).length, 0),
    startup: db.cohortSessions.filter((s) => s.session_id && s.date >= today && s.date <= weekEnd).length,
    launchpad: db.lpSessions.filter((s) => s.status !== 'cancelled' && s.date >= today && s.date <= weekEnd).length,
    vac: db.vacSessions.filter((s) => s.session_id && s.date >= today && s.date <= weekEnd).length,
  }

  const overview = {
    today,
    totals: {
      users: member.length,
      pendingApprovals: member.reduce((n, u) => n + Object.values(u.memberships).filter((s) => s === 'pending').length, 0),
      atRiskUsers: flaggedEmails.size,
      highRiskUsers: highEmails.size,
      missingItems: consulting.reduce((n, f) => n + f.missingMom + f.missingTasks + f.missingDeliverables, 0),
      sessionsThisWeek: Object.values(upcomingThisWeek).reduce((a, b) => a + b, 0),
      fundingReceived: incubation.reduce((n, f) => n + f.fundingReceived, 0),
      mouRenewalsDue: incubation.filter((f) => f.mouUploaded && f.mouDays <= MOU_RENEWAL_WARN_DAYS).length,
    },
    byPillar: USER_PILLARS.map((p) => ({
      pillar: p.id,
      title: p.title,
      approved: member.filter((u) => u.memberships[p.id] === 'approved').length,
      pending: member.filter((u) => u.memberships[p.id] === 'pending').length,
      atRisk: new Set(flags.filter((f) => f.pillar === p.id).map((f) => lc(f.email))).size,
    })),
    upcomingThisWeek,
    pendingApprovals: member.flatMap((u) => Object.entries(u.memberships).filter(([, s]) => s === 'pending').map(([pillar]) => ({ email: u.email, name: u.name || u.email, pillar, pillarTitle: titleOf(pillar) }))),
    mouRenewals: incubation
      .filter((f) => f.mouUploaded)
      .sort((a, b) => a.mouDays - b.mouDays)
      .slice(0, 5)
      .map((f) => ({ email: f.startup.email, startup: f.startup.startup, uploaded: f.mouUploaded, renewal: f.mouRenewal, days: f.mouDays })),
    topFlags: flags.slice(0, 6),
  }

  return { today, users, flags, workload, reports, overview }
}

export async function getModel() {
  return buildModel(await loadDb())
}

/* ---------------- user management (the only writes) ---------------- */
const generatePassword = () => Array.from({ length: GENERATED_PASSWORD_LEN }, () => PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)]).join('')

function cleanPassword(v) {
  const p = cleanText(v, 'password', { required: true, max: PASSWORD_MAX })
  if (p.length < PASSWORD_MIN) fail(400, `password must be at least ${PASSWORD_MIN} characters.`)
  return p
}

// body.memberships: { [pillar]: 'approved' | 'pending' | 'rejected' | '' }. '' removes the pillar.
function cleanMemberships(raw) {
  if (raw === undefined) return {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(400, 'memberships must be an object of pillar: status.')
  const out = {}
  for (const [pillar, status] of Object.entries(raw)) {
    if (pillar === 'consulting') fail(400, 'Consulting access is managed from the Consulting admin (Students).')
    if (!GRANTABLE_PILLARS.some((p) => p.id === pillar)) fail(400, `Unknown workspace: ${pillar}.`)
    if (status !== '' && !MEMBERSHIP_STATUSES.includes(status)) fail(400, `status must be one of: ${MEMBERSHIP_STATUSES.join(', ')}.`)
    out[pillar] = status
  }
  return out
}

// "startup:approved,vac:pending", or "none" so a blank cell isn't read back as the legacy startup default.
const serialiseMemberships = (m) => {
  const parts = Object.entries(m).filter(([, s]) => s).map(([p, s]) => `${p}:${s}`)
  return parts.length ? parts.join(',') : 'none'
}

async function emailTaken(email) {
  const [students, consultees, admins] = await Promise.all([allRows(STUDENTS_TAB), consultingList('Consultees', { fresh: true }), consultingList('Admins', { fresh: true })])
  return [...students, ...consultees, ...admins].some((r) => sameEmail(r.email, email))
}

export async function createUser(body) {
  const email = cleanEmail(body.email)
  const name = cleanText(body.name, 'name', { required: true, max: MAX_FIELD_CHARS })
  const password = body.password ? cleanPassword(body.password) : generatePassword()
  const memberships = cleanMemberships(body.memberships)
  const consulting = body.consulting && typeof body.consulting === 'object' ? body.consulting : null
  if (!Object.values(memberships).some(Boolean) && !consulting) fail(400, 'Choose at least one workspace for this user.')
  if (await emailTaken(email)) fail(409, 'That email already has an account.')

  if (Object.values(memberships).some(Boolean)) {
    await append(STUDENTS_TAB, { email, password, name, memberships: serialiseMemberships(memberships) })
    invalidateRoster()
  }
  if (consulting) {
    const field = (k) => cleanText(consulting[k], k, { max: MAX_FIELD_CHARS })
    await consultingInsert('Consultees', {
      email, password, name, department: field('department'), course: field('course'), sem: field('sem'), phone: field('phone'),
      startup_name: field('startup_name'), created_date: istToday(),
    })
  }
  return { email, name, password, memberships: { ...memberships, ...(consulting ? { consulting: 'approved' } : {}) } }
}

// body: { email, name?, password?, memberships? }. Admin accounts are never editable here.
export async function updateUser(body) {
  const email = cleanEmail(body.email)
  if (isDemoEmail(email)) fail(404, 'User not found.')
  const [students, consultees, admins] = await Promise.all([allRows(STUDENTS_TAB), consultingList('Consultees', { fresh: true }), consultingList('Admins', { fresh: true })])
  if (admins.some((a) => sameEmail(a.email, email))) fail(400, 'Admin accounts are managed in the Admins tab.')
  const row = students.find((s) => sameEmail(s.email, email))
  const consultee = consultees.find((c) => sameEmail(c.email, email))
  if (!row && !consultee) fail(404, 'User not found.')

  const changes = {}
  if (body.name !== undefined) changes.name = cleanText(body.name, 'name', { required: true, max: MAX_FIELD_CHARS })
  if (body.password !== undefined) changes.password = cleanPassword(body.password)
  const requested = cleanMemberships(body.memberships)

  const current = row ? Object.fromEntries(membershipsOf(row.memberships).filter((m) => m.pillar !== 'consulting').map((m) => [m.pillar, m.status])) : {}
  const merged = { ...current, ...requested }
  if (Object.keys(requested).length) changes.memberships = serialiseMemberships(merged)
  if (!Object.keys(changes).length) fail(400, 'Nothing to update.')

  if (row) await patchWhere(STUDENTS_TAB, { email: row.email }, changes)
  else await append(STUDENTS_TAB, { email: consultee.email, password: changes.password ?? consultee.password, name: changes.name ?? consultee.name, memberships: changes.memberships ?? 'none' }) // a consulting-only user gets a Students row to hold the new workspace(s)
  invalidateRoster()
  return { email, memberships: merged, updated: Object.keys(changes).filter((k) => k !== 'password') }
}

export const USER_PILLAR_CHOICES = GRANTABLE_PILLARS.map((p) => ({ id: p.id, title: p.title }))
