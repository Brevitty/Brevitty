// Shared by the API (api/_lib/consulting/*), the setup script and the UI.
// Not demo content: schema + rules only. Demo rows live in scripts/setup-consulting-tabs.mjs.

export const TZ = 'Asia/Kolkata'

// Tab schemas: exact row-1 headers, in column order. Email is the join key.
export const TABS = {
  Consultees: ['email', 'password', 'name', 'department', 'course', 'sem', 'phone', 'startup_name', 'created_date'],
  Admins: ['email', 'password', 'name'],
  // New columns go at the END: the setup script appends missing headers, and existing rows just read them as ''.
  ConsultingSessions: [
    'session_id', 'email', 'date', 'start_time', 'end_time', 'topic', 'status',
    'mom', 'calendar_event_id', 'meet_link', 'created_at', 'mom_link', 'mom_submitted_at',
    // no_tasks / no_deliverables / archived hold 'TRUE' or ''. rescheduled_from is 'date|start|end' of the old
    // slot (set only by sir); reschedule_seen flips to 'TRUE' when the student opens the session.
    'no_tasks', 'no_deliverables', 'archived', 'rescheduled_from', 'reschedule_seen',
  ],
  Tasks: ['task_id', 'session_id', 'email', 'task', 'due_date', 'status', 'completed_date', 'note'],
  Deliverables: ['deliverable_id', 'session_id', 'email', 'title', 'link', 'status', 'submitted_date', 'note'],
}

// Column that identifies a row in each tab.
export const KEY_COL = {
  Consultees: 'email',
  Admins: 'email',
  ConsultingSessions: 'session_id',
  Tasks: 'task_id',
  Deliverables: 'deliverable_id',
}

export const DATE_COLS = ['date', 'due_date', 'completed_date', 'submitted_date', 'created_date']
export const TIME_COLS = ['start_time', 'end_time']

export const SESSION_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show']
// Sessions that actually happened, so a student can file minutes and deliverables once they end.
export const SUBMITTABLE_STATUSES = ['scheduled', 'completed']
export const TASK_STATUSES = ['open', 'done']
export const DELIVERABLE_STATUSES = ['pending', 'submitted', 'reviewed']

// One consultant: 30-minute grid from 10:00 to 18:00 IST.
export const SLOT_STEP_MIN = 30
export const DAY_START = '10:00'
export const DAY_END = '18:00'
export const DURATIONS_MIN = [30, 45, 60]

// A consultee with no (non-cancelled) session for this many days shows up on the admin "Today" view.
export const INACTIVE_AFTER_DAYS = 14

export const ROLES = { admin: 'admin', student: 'student' }
