// Admin surface, part 1: consultees + dashboard summary. Guarded by auth: 'admin' in the dispatcher.
import crypto from 'crypto'
// Reads go through listReal / findRealOr404 (demo account excluded); the login-uniqueness check reads every row.
import { findRealOr404 as findOr404, listReal as list } from './shared.js'
import { list as listAll, insert, patch, pub } from '../store.js'
import {
  addDays, byDateTime, cleanEmail, cleanText, fail, isUpcoming, istToday, sameEmail,
} from '../rules.js'
import { INACTIVE_AFTER_DAYS } from '../../../../src/data/consultingConstants.js'
import { isArchived, sirItems, studentItems } from '../missing.js'

const MAX_FIELD_CHARS = 200
const DAYS_PER_WEEK = 7
const NEXT_SESSIONS_SHOWN = 3
const PASSWORD_MIN = 6
const PASSWORD_MAX = 128
const GENERATED_PASSWORD_LEN = 10
// No 0/O/1/l/I: sir reads these out over WhatsApp.
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const generatePassword = () =>
  Array.from({ length: GENERATED_PASSWORD_LEN }, () => PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)]).join('')

const isLive = (s) => s.status !== 'cancelled' && !isArchived(s)

async function listConsultees() {
  const [consultees, sessions, tasks] = await Promise.all([list('Consultees'), list('ConsultingSessions'), list('Tasks')])
  const today = istToday()
  return {
    consultees: consultees.map((c) => {
      const mine = sessions.filter((s) => sameEmail(s.email, c.email) && isLive(s))
      const past = mine.filter((s) => s.date <= today).sort(byDateTime)
      const upcoming = mine.filter((s) => s.date >= today && s.status === 'scheduled').sort(byDateTime)
      return {
        ...pub(c),
        session_count: mine.length,
        last_session_date: past.at(-1)?.date ?? '',
        next_session_date: upcoming[0]?.date ?? '',
        open_tasks: tasks.filter((t) => sameEmail(t.email, c.email) && t.status === 'open').length,
      }
    }),
  }
}

async function createConsultee({ body }) {
  const email = cleanEmail(body.email)
  const password = cleanText(body.password, 'password', { required: true, max: PASSWORD_MAX })
  if (password.length < PASSWORD_MIN) fail(400, `password must be at least ${PASSWORD_MIN} characters.`)
  const field = (k) => cleanText(body[k], k, { max: MAX_FIELD_CHARS })

  // One login namespace across both tabs: an email can't be both, or twice.
  const [admins, consultees] = await Promise.all([listAll('Admins', { fresh: true }), listAll('Consultees', { fresh: true })])
  if ([...admins, ...consultees].some((a) => sameEmail(a.email, email))) fail(409, 'That email already has an account.')

  const row = await insert('Consultees', {
    email,
    password,
    name: cleanText(body.name, 'name', { required: true, max: MAX_FIELD_CHARS }),
    department: field('department'),
    course: field('course'),
    sem: field('sem'),
    phone: field('phone'),
    startup_name: field('startup_name'),
    created_date: istToday(),
  })
  return { consultee: pub(row, { keepPassword: true }) } // sir needs to see the password once, right here
}

// Edit profile fields and/or reset the password. Email is the join key, so it is never changed here.
const EDITABLE = ['name', 'department', 'course', 'sem', 'phone', 'startup_name']
async function updateConsultee({ body }) {
  const c = await findOr404('Consultees', body.email, 'Consultee')
  const changes = {}
  for (const k of EDITABLE) {
    if (body[k] === undefined) continue
    changes[k] = cleanText(body[k], k, { required: k === 'name', max: MAX_FIELD_CHARS })
  }
  if (body.password !== undefined) {
    const password = cleanText(body.password, 'password', { required: true, max: PASSWORD_MAX })
    if (password.length < PASSWORD_MIN) fail(400, `password must be at least ${PASSWORD_MIN} characters.`)
    changes.password = password
  }
  return { consultee: pub(await patch('Consultees', c.email, changes, c), { keepPassword: true }) }
}

// Full timeline: the consultee (with password, for sir) and every session with its tasks + deliverables.
async function consulteeDetail({ query }) {
  const consultee = await findOr404('Consultees', query.email, 'Consultee')
  const [sessions, tasks, deliverables] = await Promise.all([
    list('ConsultingSessions'),
    list('Tasks'),
    list('Deliverables'),
  ])
  const mine = (row) => sameEmail(row.email, consultee.email)
  return {
    consultee: pub(consultee, { keepPassword: true }),
    sessions: sessions
      .filter((s) => mine(s) && !isArchived(s))
      .sort(byDateTime)
      .map((s) => ({
        ...pub(s),
        tasks: tasks.filter((t) => mine(t) && t.session_id === s.session_id).map(pub),
        deliverables: deliverables.filter((d) => mine(d) && d.session_id === s.session_id).map(pub),
      })),
  }
}

async function summary() {
  const [consultees, sessions, tasks, deliverables] = await Promise.all([
    list('Consultees'),
    list('ConsultingSessions'),
    list('Tasks'),
    list('Deliverables'),
  ])
  const today = istToday()
  const nameOf = (email) => consultees.find((c) => sameEmail(c.email, email))?.name ?? email
  const cutoff = addDays(today, -INACTIVE_AFTER_DAYS)

  // What is missing, from the shared rules (api/_lib/consulting/missing.js), grouped per session.
  const now = Date.now()
  const withRows = sessions.filter((s) => !isArchived(s)).map((s) => ({
    ...s,
    tasks: tasks.filter((t) => t.session_id === s.session_id),
    deliverables: deliverables.filter((d) => d.session_id === s.session_id),
  }))
  const group = (items, s) => ({
    session_id: s.session_id, email: s.email, consultee_name: nameOf(s.email), date: s.date, topic: s.topic, items,
  })
  const missingFrom = (pick) => withRows.map((s) => group(pick(s, now), s)).filter((g) => g.items.length).sort((a, b) => b.date.localeCompare(a.date))
  const liveSessionIds = new Set(withRows.filter(isLive).map((s) => s.session_id))

  const missingFromMe = missingFrom(sirItems)
  const weekStart = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % DAYS_PER_WEEK)) // Monday
  const weekEnd = addDays(weekStart, DAYS_PER_WEEK - 1)
  const upcoming = withRows.filter((s) => isLive(s) && isUpcoming(s, now)).sort(byDateTime)
  const countKind = (kind) => missingFromMe.filter((g) => g.items.some((i) => i.kind === kind)).length

  return {
    today,
    counts: {
      upcoming: upcoming.length,
      this_week: upcoming.filter((s) => s.date >= weekStart && s.date <= weekEnd).length,
      students: consultees.length,
      missing_mom: countKind('mom'),
      missing_deliverables: countKind('deliverables'),
      missing_tasks: countKind('tasks'),
    },
    next_sessions: upcoming.slice(0, NEXT_SESSIONS_SHOWN).map((s) => ({ ...pub(s), consultee_name: nameOf(s.email) })),
    missing_from_students: missingFrom(studentItems),
    missing_from_me: missingFromMe,
    sessions_today: sessions
      .filter((s) => s.date === today && isLive(s))
      .sort(byDateTime)
      .map((s) => ({ ...pub(s), consultee_name: nameOf(s.email) })),
    overdue_tasks: tasks
      .filter((t) => liveSessionIds.has(t.session_id) && t.status === 'open' && t.due_date && t.due_date < today)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .map((t) => ({ ...pub(t), consultee_name: nameOf(t.email) })),
    // "No session in 14 days": nothing live dated on/after the cutoff (upcoming counts as recent).
    inactive_consultees: consultees
      .map((c) => {
        const mine = sessions.filter((s) => sameEmail(s.email, c.email) && isLive(s)).sort(byDateTime)
        return { c, last: mine.filter((s) => s.date <= today).at(-1)?.date ?? '', recent: mine.some((s) => s.date >= cutoff) }
      })
      .filter((x) => !x.recent)
      .map(({ c, last }) => ({ email: c.email, name: c.name, startup_name: c.startup_name, last_session_date: last })),
  }
}

export default {
  'GET admin/consultees': { auth: 'admin', fn: listConsultees },
  'POST admin/consultees': { auth: 'admin', fn: createConsultee, status: 201 },
  'PATCH admin/consultees': { auth: 'admin', fn: updateConsultee },
  'GET admin/consultee': { auth: 'admin', fn: consulteeDetail },
  'GET admin/generate-password': { auth: 'admin', fn: async () => ({ password: generatePassword() }) },
  'GET admin/summary': { auth: 'admin', fn: summary },
}
