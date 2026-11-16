// Config for the public /register flow. Imported by the pages AND by api/register.js, so the
// option ids, campuses and allowed values live in exactly one place.

export const OPTION_IDS = ['startup-junction', 'startup-arena', 'mentorship', 'grants']

// Campuses that qualify for the verified-student path (Step 2 + all four options).
export const VERIFIED_CAMPUSES = ['Purnima University', 'PCE', 'PIT', 'GCEC']
export const OTHER_CAMPUS = 'Others'

// Card copy. `description` is the one-liner on the card; `success` is shown after registering.
export const REGISTRATION_OPTIONS = {
  'startup-junction': {
    title: 'Startup Junction',
    // TODO(copy): final one-liner for Startup Junction — placeholder until supplied.
    description: 'TODO: Startup Junction one-line description.',
    // TODO(copy): final confirmation line for Startup Junction.
    success: "You're in! We'll reach out with next steps.",
  },
  'startup-arena': {
    title: 'Startup Arena',
    // TODO(copy): final one-liner for Startup Arena — placeholder until supplied.
    description: 'TODO: Startup Arena one-line description.',
    // TODO(copy): final confirmation line for Startup Arena.
    success: "You're in! We'll reach out with next steps.",
  },
  mentorship: {
    title: 'One-on-One Mentorship',
    description: 'Get matched with an experienced mentor for focused, personal guidance on your idea or startup.',
    success: "You're in! We'll match you with a mentor and reach out with next steps.",
  },
  grants: {
    title: 'Competitions and Grants',
    description: 'Get support to find, prepare and apply for startup competitions, grants and funding.',
    success: "You're in! We'll share open competitions and grants with you soon.",
  },
}

// Cards per path, in display order.
export const STUDENT_OPTIONS = ['startup-junction', 'startup-arena', 'mentorship', 'grants']
export const OPEN_OPTIONS = ['mentorship', 'grants']

// Field limits, shared by the forms (maxLength) and the server (hard caps).
export const LIMITS = { name: 80, email: 254, campusText: 80, field: 80, semester: 20 }

// Validators shared by client and server.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const PHONE_RE = /^[6-9]\d{9}$/ // 10-digit Indian mobile
export const normalisePhone = (v) => String(v ?? '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')
