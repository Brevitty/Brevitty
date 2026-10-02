// Draft/save logic for the admin Session detail screen: one Save persists the
// session fields plus task and deliverable rows (create / update / delete).
// Each successful write is folded back into both draft and baseline as it
// lands, so a mid-way failure leaves nothing to redo twice (no duplicate rows).
import { admin } from '../../../lib/consultingApi.js'

const SESSION_FIELDS = ['topic', 'mom', 'status', 'date', 'start_time', 'end_time', 'no_tasks', 'no_deliverables']
const TASK_FIELDS = ['task', 'due_date', 'status']
const DELIVERABLE_FIELDS = ['title', 'link', 'status']

let keySeq = 0
const withKey = (row) => ({ _key: `k${++keySeq}`, ...row })
const pick = (obj, fields) => Object.fromEntries(fields.map((f) => [f, obj[f] ?? '']))

export const newTask = () => withKey({ task: '', due_date: '', status: 'open' })
export const newDeliverable = () => withKey({ title: '', link: '', status: 'pending' })

export function toDraft({ session, tasks, deliverables }) {
  return {
    session: pick(session, SESSION_FIELDS),
    tasks: tasks.map((t) => withKey({ task_id: t.task_id, ...pick(t, TASK_FIELDS) })),
    deliverables: deliverables.map((d) => withKey({ deliverable_id: d.deliverable_id, ...pick(d, DELIVERABLE_FIELDS) })),
  }
}

// A brand-new row the user never typed into doesn't count as a change.
const isBlankNew = (row, idKey, textKey) => !row[idKey] && !String(row[textKey]).trim() && !String(row.link ?? row.due_date ?? '').trim()
const meaningful = (d) => ({
  session: d.session,
  tasks: d.tasks.filter((t) => !isBlankNew(t, 'task_id', 'task')).map((t) => ({ id: t.task_id, ...pick(t, TASK_FIELDS) })),
  deliverables: d.deliverables
    .filter((x) => !isBlankNew(x, 'deliverable_id', 'title'))
    .map((x) => ({ id: x.deliverable_id, ...pick(x, DELIVERABLE_FIELDS) })),
})
export const isDirty = (draft, base) => JSON.stringify(meaningful(draft)) !== JSON.stringify(meaningful(base))

export function validate(draft) {
  if (draft.tasks.some((t) => !isBlankNew(t, 'task_id', 'task') && !t.task.trim())) return 'Every task needs a description (or remove the row).'
  if (draft.deliverables.some((d) => !isBlankNew(d, 'deliverable_id', 'title') && !d.title.trim())) return 'Every deliverable needs a title (or remove the row).'
  return ''
}

const changed = (row, baseRow, fields) => fields.some((f) => String(row[f] ?? '') !== String(baseRow?.[f] ?? ''))
const changes = (row, baseRow, fields) => Object.fromEntries(fields.filter((f) => String(row[f] ?? '') !== String(baseRow?.[f] ?? '')).map((f) => [f, row[f]]))

// Generic row sync for tasks / deliverables. Mutates `draftRows` / `baseRows` arrays in place.
async function syncRows({ draftRows, baseRows, idKey, textKey, fields, create, update, remove, sessionId }) {
  const liveIds = new Set(draftRows.map((r) => r[idKey]).filter(Boolean))
  for (const b of [...baseRows]) {
    if (!liveIds.has(b[idKey])) {
      await remove(b[idKey])
      baseRows.splice(baseRows.indexOf(b), 1)
    }
  }
  for (let i = 0; i < draftRows.length; i++) {
    const row = draftRows[i]
    if (!row[idKey]) {
      if (isBlankNew(row, idKey, textKey)) continue
      const saved = await create({ session_id: sessionId, ...pick(row, fields) })
      const clean = withKey({ [idKey]: saved[idKey], ...pick(saved, fields) })
      draftRows[i] = { ...clean, _key: row._key }
      baseRows.push(clean)
      // The API opens tasks as "open"; apply a status picked before the first save.
      if (saved.status !== row.status) {
        const upd = await update(saved[idKey], { status: row.status })
        draftRows[i] = { ...draftRows[i], ...pick(upd, fields) }
        baseRows[baseRows.length - 1] = { ...clean, ...pick(upd, fields) }
      }
      continue
    }
    const bi = baseRows.findIndex((b) => b[idKey] === row[idKey])
    if (bi >= 0 && changed(row, baseRows[bi], fields)) {
      const upd = await update(row[idKey], changes(row, baseRows[bi], fields))
      baseRows[bi] = { ...baseRows[bi], ...pick(upd, fields) }
    }
  }
}

// Returns { draft, base, error } — both reflect whatever was actually saved.
export async function persist(sessionId, draftIn, baseIn) {
  const draft = { session: { ...draftIn.session }, tasks: [...draftIn.tasks], deliverables: [...draftIn.deliverables] }
  const base = { session: { ...baseIn.session }, tasks: [...baseIn.tasks], deliverables: [...baseIn.deliverables] }
  try {
    if (changed(draft.session, base.session, SESSION_FIELDS)) {
      const { session } = await admin.updateSession(sessionId, changes(draft.session, base.session, SESSION_FIELDS))
      base.session = pick(session, SESSION_FIELDS)
    }
    await syncRows({
      draftRows: draft.tasks,
      baseRows: base.tasks,
      idKey: 'task_id',
      textKey: 'task',
      fields: TASK_FIELDS,
      sessionId,
      create: async (f) => (await admin.createTask(f)).task,
      update: async (id, c) => (await admin.updateTask(id, c)).task,
      remove: admin.deleteTask,
    })
    await syncRows({
      draftRows: draft.deliverables,
      baseRows: base.deliverables,
      idKey: 'deliverable_id',
      textKey: 'title',
      fields: DELIVERABLE_FIELDS,
      sessionId,
      create: async (f) => (await admin.createDeliverable(f)).deliverable,
      update: async (id, c) => (await admin.updateDeliverable(id, c)).deliverable,
      remove: admin.deleteDeliverable,
    })
    return { draft, base, error: '' }
  } catch (err) {
    return { draft, base, error: err.message }
  }
}
