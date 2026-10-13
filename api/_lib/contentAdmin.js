// Hub Admin > Content: the team-curated reference tabs, edited from the Hub instead of the sheet,
// so content never needs a code change. Each tab is described once here (fields + validation); the
// admin UI renders its table and form from the same description (served by GET admin/content).
import { allRows, upsert, newId } from './pillarStore.js'
import { readSheetRows, updateSheetRow, invalidateTab, cellToString } from './sheetsClient.js'
import { fail, cleanText, cleanDate, cleanLink, cleanEmail } from './consulting/rules.js'
import { withoutDemo, isDemoSessionId, DEMO_VAC_BATCH } from './accounts.js'
import { STAGES } from '../../src/data/journeyData.js'

const JOURNEY_ITEMS = STAGES.flatMap((s) => s.deliverables.filter((d) => !d.computed).map((d) => ({ value: d.id, label: `${s.label}: ${d.label}` })))

const TEXT_MAX = 200
const LONG_MAX = 2000
const SHEET_LAST_COL_CODE = 64 // 'A' - 1

// type: text | long | lines (one item per line) | url | date | email | bool | select
const f = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra })

export const CONTENT_TABS = {
  Competitions: {
    title: 'Competitions', key: 'comp_id', idPrefix: 'comp', titleField: 'name',
    note: 'Shown to Startup Junction founders under My Journey > Competitions while Active is on.',
    fields: [
      f('name', 'Name', 'text', { required: true }), f('org', 'Organiser'), f('about', 'About', 'long'), f('eligibility', 'Eligibility', 'long'),
      f('event_date', 'Event dates (free text)'), f('deadline', 'Application deadline', 'date', { required: true }), f('deadline_note', 'Deadline note'),
      f('prize', 'Prize'), f('url', 'Official link', 'url', { required: true }), f('checklist', 'Steps to apply (one per line)', 'lines'), f('active', 'Active', 'bool'),
    ],
  },
  Mentors: {
    title: 'Startup Junction mentors', key: 'mentor_id', idPrefix: 'mentor', titleField: 'name',
    note: 'Founders see the mentors assigned to them (MentorAssignments tab).',
    fields: [f('name', 'Name', 'text', { required: true }), f('expertise', 'Expertise'), f('bio', 'Bio', 'long'), f('contact_email', 'Contact email', 'email')],
  },
  LP_Mentors: {
    title: 'Launchpad mentors', key: 'mentor_id', idPrefix: 'lpm', titleField: 'name',
    note: 'The contact email is the mentor’s Hub login: it opens the Launchpad mentor view.',
    fields: [f('name', 'Name', 'text', { required: true }), f('expertise', 'Expertise'), f('bio', 'Bio', 'long'), f('contact_email', 'Contact email (Hub login)', 'email', { required: true })],
  },
  INC_SchemeList: {
    title: 'Government schemes', key: 'id', idPrefix: 'scheme', titleField: 'name',
    note: 'Shown to Incubation startups under Schemes while Active is on.',
    fields: [
      f('name', 'Name', 'text', { required: true }), f('authority', 'Authority'), f('description', 'Description', 'long'), f('eligibility', 'Eligibility', 'long'),
      f('max_benefit', 'Maximum benefit'), f('deadline', 'Deadline (blank = rolling)', 'date'), f('apply_url', 'Apply link', 'url', { required: true }), f('active', 'Active', 'bool'),
    ],
  },
  ItemResources: {
    title: 'Journey templates', key: 'item_id', titleField: 'item_id',
    note: 'Template / example links on Startup Junction journey items. The buttons appear only when a link is set.',
    fields: [
      f('item_id', 'Journey item', 'select', { required: true, options: JOURNEY_ITEMS }),
      f('template_url', 'Template link', 'url'), f('example_url', 'Example link', 'url'),
    ],
  },
  CohortSessions: {
    title: 'Startup Junction sessions', key: 'session_id', idPrefix: 'session', titleField: 'topic',
    note: 'Cohort sessions every Startup Junction founder sees (Sessions and Attendance).',
    fields: [
      f('date', 'Date', 'date', { required: true }), f('time', 'Time (e.g. 5:00 PM – 6:00 PM IST)'), f('platform', 'Platform'), f('mentor', 'Mentor'),
      f('topic', 'Topic', 'text', { required: true }), f('summary', 'Summary (after the session)', 'long'), f('action_item', 'Action item'),
    ],
  },
  VAC_Sessions: {
    title: 'VAC classes', key: 'session_id', idPrefix: 'vac', titleField: 'title',
    note: 'Learners see the classes of their course (and batch, when set).',
    fields: [
      f('date', 'Date', 'date', { required: true }), f('time', 'Time (HH:MM)'), f('title', 'Title', 'text', { required: true }),
      f('course', 'Course', 'text', { required: true }), f('batch', 'Batch (blank = every batch)'),
    ],
  },
}

const configOf = (tab) => (Object.hasOwn(CONTENT_TABS, tab) ? CONTENT_TABS[tab] : fail(400, 'Unknown content type.'))
// Demo-account rows (and the demo VAC batch) never show up in admin views.
const visible = (tab, rows) =>
  withoutDemo(rows).filter((r) => r[CONTENT_TABS[tab].key] && !(tab === 'VAC_Sessions' && r.batch === DEMO_VAC_BATCH) && !(tab === 'CohortSessions' && isDemoSessionId(r.session_id)))

export async function listContent(tab) {
  const cfg = configOf(tab)
  const rows = visible(tab, await allRows(tab)).map((r) => Object.fromEntries([cfg.key, ...cfg.fields.map((x) => x.name)].map((k) => [k, r[k] ?? ''])))
  return { tab, rows, tabs: Object.entries(CONTENT_TABS).map(([id, c]) => ({ id, ...c })) }
}

function cleanField(field, raw) {
  const v = typeof raw === 'string' ? raw.trim() : raw
  const opts = { required: Boolean(field.required) }
  switch (field.type) {
    case 'bool': return v === true || v === 'TRUE' ? 'TRUE' : ''
    case 'url':
      if (!v && field.required) fail(400, `${field.label} is required.`)
      if (v && !/^https?:\/\//i.test(v)) fail(400, `${field.label} must start with https://`)
      return cleanLink(v)
    case 'date': return cleanDate(v, field.label, opts)
    case 'email': return v || field.required ? cleanEmail(v) : ''
    case 'select':
      if (!field.options.some((o) => o.value === v)) fail(400, `${field.label}: choose one of the options.`)
      return v
    case 'lines': return cleanText(String(v ?? '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n'), field.label, { ...opts, max: LONG_MAX })
    default: return cleanText(v, field.label, { ...opts, max: field.type === 'long' ? LONG_MAX : TEXT_MAX })
  }
}

// body: { tab, key? (edit), row: { field: value } }. A new row gets a generated key (ItemResources
// is keyed by the chosen journey item instead, so it has one row per item).
export async function saveContent(body) {
  const cfg = configOf(body.tab)
  const input = body.row && typeof body.row === 'object' ? body.row : fail(400, 'row must be an object.')
  const values = Object.fromEntries(cfg.fields.map((x) => [x.name, cleanField(x, input[x.name])]))
  const rows = await allRows(body.tab)
  let key = typeof body.key === 'string' ? body.key : ''
  if (key && !visible(body.tab, rows).some((r) => r[cfg.key] === key)) fail(404, 'That entry no longer exists.')
  if (!key) key = cfg.idPrefix ? newId(cfg.idPrefix) : values[cfg.key]
  else if (values[cfg.key] !== undefined && values[cfg.key] !== key) fail(400, 'The journey item of an existing entry can’t change. Delete it and add a new one.')
  if (!body.key && !cfg.idPrefix && rows.some((r) => r[cfg.key] === key)) fail(409, 'That journey item already has links. Edit the existing entry instead.')
  if (body.tab === 'LP_Mentors' && rows.some((r) => r[cfg.key] !== key && String(r.contact_email).trim().toLowerCase() === values.contact_email)) {
    fail(409, 'Another Launchpad mentor already uses that email.')
  }
  await upsert(body.tab, { [cfg.key]: key }, values)
  return listContent(body.tab)
}

// Blanks the row (readers skip blank rows), so row numbers never shift under a concurrent write.
export async function deleteContent(body) {
  const cfg = configOf(body.tab)
  const values = await readSheetRows(body.tab)
  const header = (values[0] || []).map((h) => cellToString(h).trim())
  const at = values.findIndex((r, i) => i > 0 && cellToString(r[header.indexOf(cfg.key)]).trim() === String(body.key ?? ''))
  if (at < 0 || !visible(body.tab, [Object.fromEntries(header.map((h, i) => [h, cellToString(values[at][i]).trim()]))]).length) fail(404, 'That entry no longer exists.')
  await updateSheetRow(body.tab, at + 1, header.map(() => ''), String.fromCharCode(SHEET_LAST_COL_CODE + header.length))
  invalidateTab(body.tab)
  return listContent(body.tab)
}
