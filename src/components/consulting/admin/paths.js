// Admin routes in one place (kept out of AdminApp.jsx so views can import it without a cycle).
export const ADMIN_BASE = '/hub/consulting-admin'
export const paths = {
  today: ADMIN_BASE,
  consultees: `${ADMIN_BASE}/consultees`,
  consultee: (email) => `${ADMIN_BASE}/consultees/${encodeURIComponent(email)}`,
  schedule: (email) => `${ADMIN_BASE}/schedule${email ? `?email=${encodeURIComponent(email)}` : ''}`,
  tasks: `${ADMIN_BASE}/tasks`,
  sessions: `${ADMIN_BASE}/sessions`,
  session: (id) => `${ADMIN_BASE}/sessions/${encodeURIComponent(id)}`,
}
