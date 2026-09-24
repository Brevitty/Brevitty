// Mock data for the signed-in Startup Junction dashboard.
// Shaped exactly as the eventual Google Sheets-backed data will be, so
// StartupJunctionPage and its section components can be pointed at a real
// fetch later without changing props or rendering logic.

// TODO: replace with real API/Sheets call
export const STUDENT_PROFILE = {
  teamName: 'Re-Loop',
}

// Sidebar-only cohort progress summary (DashboardSidebar's CohortMiniCard) —
// a separate 6-item taxonomy from journeyData's checklist-derived STAGES used
// by Overview/My Journey. Known to disagree with those; not fixed here since
// only the Overview card was in scope for this pass.
// TODO: replace with real API/Sheets call
export const MILESTONES = [
  { id: 'idea', n: '01', label: 'Ideation', status: 'complete' },
  { id: 'competitor', n: '02', label: 'Validation', status: 'complete' },
  { id: 'gtm', n: '03', label: 'Build', status: 'complete' },
  { id: 'mvp', n: '04', label: 'MVP', status: 'current' },
  { id: 'deck', n: '05', label: 'Launch', status: 'upcoming' },
  { id: 'model', n: '06', label: 'Scale', status: 'upcoming' },
]

// TODO: replace with real API/Sheets call
export const SESSIONS = [
  {
    id: 'session-3',
    date: '2026-09-29',
    time: '4:00 PM – 5:00 PM IST',
    platform: 'Google Meet',
    mentor: 'Priya Nair',
    topic: 'MVP scope review',
    status: 'upcoming',
  },
  {
    id: 'session-2',
    date: '2026-09-15',
    time: '5:00 PM – 5:45 PM IST',
    platform: 'Google Meet',
    mentor: 'Rohan Mehta',
    topic: 'GTM channel walkthrough',
    status: 'past',
    summary: 'Narrowed the ICP to college hostel residents and mapped two acquisition channels: campus WhatsApp groups and hostel wardens.',
    actionItem: 'Interview 5 more students outside your own hostel by Friday.',
  },
  {
    id: 'session-1',
    date: '2026-09-01',
    time: '5:00 PM – 5:45 PM IST',
    platform: 'Google Meet',
    mentor: 'Rohan Mehta',
    topic: 'Idea validation check-in',
    status: 'past',
    summary: 'Idea holds up — confirmed workaround (WhatsApp groups) and willingness to pay ₹50/listing.',
    actionItem: 'Get 3 people to actually pay before the next session.',
  },
]

// TODO: replace with real API/Sheets call
export const RECENT_ACTIVITY = [
  { id: 'act-1', kind: 'document', title: 'Pitch deck requested', actor: 'Program team', time: '2 hours ago' },
  { id: 'act-2', kind: 'complete', title: 'MVP milestone completed', actor: 'You', time: 'Yesterday' },
  { id: 'act-3', kind: 'session', title: 'Session scheduled', actor: 'with Priya Nair', time: 'Sep 26' },
  { id: 'act-4', kind: 'feedback', title: 'Mentor feedback received', actor: 'Rohan Mehta', time: 'Sep 24' },
]
