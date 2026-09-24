// Single source of truth for Hub workspaces ("pillars"). Imported by the client
// (routes, sidebar, picker) AND by the API (api/_lib/roster.js validation,
// api/hub/workspace.js) — adding a pillar is a one-place change: add an entry below.
//
// NOTE: "Mentorship / Profile Building" is intentionally NOT included yet,
// pending a product decision.
//
// `slug` is the URL segment (/hub/<slug>) and equals `id` today; the roster's
// "memberships" column uses `id`.

export const MEMBERSHIP_STATUSES = ['approved', 'pending', 'rejected']

export const PILLARS = [
  {
    id: 'startup',
    slug: 'startup',
    title: 'Startup Junction Founder',
    description: 'Validate your idea, build your toolkit, and track your cohort with your mentors.',
    nav: ['Overview', 'Cohort', 'Mentors', 'Attendance', 'Sessions', 'Documents', 'Resources'],
  },
  {
    id: 'consulting',
    slug: 'consulting',
    title: 'Consulting',
    description: 'Book sessions and track guidance from your assigned consultants.',
    nav: ['Overview', 'Consultants', 'Sessions', 'Documents', 'Resources', 'Book an Appointment'],
  },
  {
    id: 'incubation',
    slug: 'incubation',
    title: 'Incubation',
    description: 'Manage compliance, funding, and KPIs for your incubated venture.',
    nav: [
      'Overview',
      'MoU & Compliance',
      'KPIs',
      'Funding',
      'Documents',
      'Schemes',
      'Media & PR',
      'Resources',
      'Exit Status',
    ],
  },
  {
    id: 'vac',
    slug: 'vac',
    title: 'VAC Learner',
    description: 'Follow your course schedule, submit assignments, and track attendance.',
    nav: ['Overview', 'Course', 'Schedule', 'Attendance', 'Content', 'Assignments', 'Certificate', 'Feedback'],
  },
  {
    id: 'partner',
    slug: 'partner',
    title: 'Partner Services',
    description: 'Manage programs, disbursements, and your relationship with Brevitty.',
    nav: ['Overview', 'Programs', 'Disbursements', 'Reporting', 'Events', 'Relationship', 'Renewals', 'MoU'],
  },
  {
    id: 'admin',
    slug: 'admin',
    title: 'Hub Admin',
    description: 'Oversee cohorts, flag at-risk accounts, and manage users across the Hub.',
    nav: ['Master Dashboard', 'At-Risk Flags', 'Workload', 'Reports', 'User Management'],
  },
]

export const getPillar = (id) => PILLARS.find((p) => p.id === id) || null
export const getPillarBySlug = (slug) => PILLARS.find((p) => p.slug === slug) || null
export const isPillarId = (id) => PILLARS.some((p) => p.id === id)
