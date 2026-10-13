import { unwrap } from './hubApi.js'
// The one data-access layer for the consulting UI. Every component talks to
// /api/consulting through these functions; nothing else calls fetch for it.

const BASE = '/api/consulting'

export class ConsultingError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Registered by ConsultingPage so any 401 anywhere drops the user to sign-in.
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

async function request(path, { method = 'GET', body, query } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''))}` : ''
  let res
  try {
    res = await fetch(`${BASE}/${path}${qs}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ConsultingError(0, 'Could not reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== 'login' && path !== 'me') onUnauthorized()
  if (!res.ok) throw new ConsultingError(res.status, data.error || 'Something went wrong.')
  return unwrap(data)
}

/* ---------------- auth ---------------- */
export const login = (email, password) => request('login', { method: 'POST', body: { email, password } })
export const me = () => request('me')
export const logout = () => request('logout', { method: 'POST' })

/* ---------------- student ---------------- */
export const getMySessions = () => request('sessions')
// mom_file: undefined keeps the attachment, '' removes it, a storage path (storage.ts) replaces it.
export const saveMyMom = (session_id, mom, mom_file) => request('sessions', { method: 'PATCH', body: { session_id, mom, mom_file } })
// changes: { status?, note? }
export const updateMyTask = (task_id, changes) => request('tasks', { method: 'PATCH', body: { task_id, ...changes } })
// The student opened a session: clears its "Rescheduled by sir" notice.
export const markSessionSeen = (session_id) => request('sessions/seen', { method: 'POST', body: { session_id } })
// flags: { no_tasks?: boolean, no_deliverables?: boolean }
export const setSessionFlags = (session_id, flags) => request('sessions/flags', { method: 'PATCH', body: { session_id, ...flags } })
export const removeMySession = (session_id) => request('sessions/remove', { method: 'POST', body: { session_id } })
// file_path: a fresh upload (storage.ts), or undefined to change only the note.
export const submitMyDeliverable = (deliverable_id, file_path, note) =>
  request('deliverables', { method: 'PATCH', body: { deliverable_id, file_path, note } })

/* ---------------- admin ---------------- */
export const admin = {
  summary: () => request('admin/summary'),
  consultees: () => request('admin/consultees'),
  consultee: (email) => request('admin/consultee', { query: { email } }),
  createConsultee: (fields) => request('admin/consultees', { method: 'POST', body: fields }),
  updateConsultee: (email, changes) => request('admin/consultees', { method: 'PATCH', body: { email, ...changes } }),
  board: () => request('admin/board'),
  generatePassword: () => request('admin/generate-password'),
  sessions: (filters) => request('admin/sessions', { query: filters }),
  session: (id) => request('admin/session', { query: { id } }),
  createSession: (fields) => request('admin/sessions', { method: 'POST', body: fields }),
  removeSession: (session_id) => request('admin/sessions/remove', { method: 'POST', body: { session_id } }),
  updateSession: (session_id, changes) => request('admin/sessions', { method: 'PATCH', body: { session_id, ...changes } }),
  createTask: (fields) => request('admin/tasks', { method: 'POST', body: fields }),
  updateTask: (task_id, changes) => request('admin/tasks', { method: 'PATCH', body: { task_id, ...changes } }),
  deleteTask: (id) => request('admin/tasks', { method: 'DELETE', query: { id } }),
  createDeliverable: (fields) => request('admin/deliverables', { method: 'POST', body: fields }),
  updateDeliverable: (deliverable_id, changes) =>
    request('admin/deliverables', { method: 'PATCH', body: { deliverable_id, ...changes } }),
  deleteDeliverable: (id) => request('admin/deliverables', { method: 'DELETE', query: { id } }),
}
