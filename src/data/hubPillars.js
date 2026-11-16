// Single source of truth for Hub workspaces ("pillars"). Imported by the client
// (routes, sidebar, picker) AND by the API (api/_lib/roster.js validation,
// api/hub.js) — adding a pillar is a one-place change: add an entry below.
// Array order is the card order on My workspace.
//
// `slug` is the URL segment (/hub/<slug>) and equals `id` today; the roster's
// "memberships" column uses `id`.
// `adminOnly`: never granted from the Students tab's memberships column. Only an email in the
//   Admins tab gets it (api/_lib/signIn.js), so a student row can't grant itself admin.

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
    href: '/consulting', // the real workspace lives outside /hub (own shell, own API)
    description: 'Book sessions and track guidance from your assigned consultants.',
    nav: ['Overview', 'Consultants', 'Sessions', 'Documents', 'Resources', 'Book an Appointment'],
  },
  {
    // Grades 9-12 building a university-abroad profile by building a startup.
    id: 'launchpad',
    slug: 'launchpad',
    title: 'Launchpad Abroad',
    description: 'For Grades 9–12: build a startup, collect the proof, and walk into university applications abroad with a profile that stands out.',
    nav: ['Overview', 'My Journey', 'Profile', 'Sessions', 'Documents'],
  },
  {
    id: 'incubation',
    slug: 'incubation',
    title: 'Incubation',
    description: 'Manage your MoU, documents, funding, and KPIs for your incubated venture.',
    nav: ['Overview', 'Profile', 'MoU & Documents', 'KPIs', 'Funding', 'Schemes'],
  },
  {
    id: 'vac',
    slug: 'vac',
    title: 'VAC Learner',
    description: 'Follow your course schedule, submit assignments, and track attendance.',
    nav: ['Overview', 'Course', 'Schedule', 'Attendance', 'Content', 'Assignments', 'Certificate', 'Feedback'],
  },
  {
    id: 'admin',
    slug: 'admin',
    title: 'Hub Admin',
    adminOnly: true,
    description: 'Oversee cohorts, flag at-risk accounts, and manage users across the Hub.',
    nav: ['Master Dashboard', 'At-Risk Flags', 'Workload', 'Reports', 'User Management', 'Launchpad students', 'Attendance', 'Content'],
  },
]

export const getPillar = (id) => PILLARS.find((p) => p.id === id) || null
export const getPillarBySlug = (slug) => PILLARS.find((p) => p.slug === slug) || null
export const isPillarId = (id) => PILLARS.some((p) => p.id === id)
export const isAdminPillar = (id) => Boolean(getPillar(id)?.adminOnly)
// Where a workspace card opens.
export const pillarHref = (p) => p.href ?? `/hub/${p.slug}`
