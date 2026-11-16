// Config for the public /register flow. Imported by the pages AND by api/register.js, so the
// option ids, campuses and allowed values live in exactly one place.

export const OPTION_IDS = ['startup-junction', 'startup-arena', 'mentorship', 'grants']

// Campuses that qualify for the verified-student path (Step 2 + all four options).
// Order is the dropdown order. These exact strings are also what lands in the sheet.
export const VERIFIED_CAMPUSES = ['Poornima University', 'GCEC', 'PCE', 'PIET']
export const OTHER_CAMPUS = 'Others'

// Student emails from these domains look right; anything else only gets a soft, non-blocking note.
export const KNOWN_STUDENT_DOMAINS = ['poornima.org', 'poornima.in', 'poornima.edu', 'gcecglobal.com']
export const STUDENT_EMAIL_HINT = 'Use your college email, e.g. name@poornima.edu'
export const STUDENT_EMAIL_WARNING = "This doesn't look like a college email we know. You can still continue."
// Subdomains count (e.g. students.poornima.edu). Never blocks submission.
export function isKnownStudentEmail(email) {
  const domain = String(email).trim().toLowerCase().split('@')[1] || ''
  return KNOWN_STUDENT_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

// Card copy. `description` is the one-liner on the card; `success` is shown after registering.
export const REGISTRATION_OPTIONS = {
  'startup-junction': {
    title: 'Startup Junction',
    description: 'Live founder sessions with expert guest speakers to build your mindset and stress-test your startup idea.',
    success: "You're registered for The Startup Junction. We'll email you the session details.",
  },
  'startup-arena': {
    title: 'Startup Arena',
    description: 'A weekly pitching stage where selected student startups present to industry experts, get mentored and earn Bronze to Diamond recognition.',
    success: "Registration received. We'll reach out about upcoming Startup Arena pitch slots.",
  },
  mentorship: {
    title: 'One-on-One Mentorship',
    description: 'Book a one-on-one session with an experienced mentor for focused guidance on your idea or startup.',
    success: "Request received. We'll match you with a mentor and email the next steps.",
  },
  grants: {
    title: 'Competitions and Grants',
    description: 'Get matched with open competitions, grants and funding opportunities for early-stage founders.',
    success: "You're on the list. We'll email you competitions and grants that fit your stage.",
  },
}

// Cards per path, in display order.
export const STUDENT_OPTIONS = ['startup-junction', 'startup-arena', 'mentorship', 'grants']
export const OPEN_OPTIONS = ['mentorship', 'grants']

/* ---------- Startup Junction extra details (mirrors the "Brevitty On-Boarding Form") ---------- */

// Stages 1-2 submit with just the basics; stages 3-4 need the full startup profile.
export const STAGES = [
  { value: 'Searching For Ideas', full: false },
  { value: 'Idea Validation/Prototype', full: false },
  { value: 'Early Traction', full: true },
  { value: 'Revenue', full: true },
]
export const isFullStage = (stage) => STAGES.some((s) => s.value === stage && s.full)

export const INDUSTRIES = [
  'SaaS', 'AI-ML', 'Fintech', 'Health Tech', 'D2C', 'Logistics and Supply Chain', 'EdTech', 'Web3', 'Mobility',
  'Climate Tech', 'Prop Tech', 'Gaming', 'Creator Economy', 'Cyber Security', 'Deep Tech', 'Agri Tech',
  'Travel & Hospitality Tech', 'Defence Tech', 'Others',
]
export const NOT_REGISTERED = 'No'
export const REGISTERED_WITH = [NOT_REGISTERED, 'Startup India - DPIIT', 'MSME (Udyam)', 'MeitY Startup Hub']

// Team Size includes the founder, so a size of N asks for N-1 additional members.
export const MAX_TEAM_SIZE = 6

// File kinds uploaded straight to storage. `kind` is the file name stem in the storage path.
export const MB = 1024 * 1024
export const FILE_KINDS = {
  pitchDeck: {
    kind: 'pitch-deck',
    label: 'Pitch deck',
    maxBytes: 10 * MB,
    types: { pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    hint: 'PDF, PPT or PPTX · max 10 MB',
  },
  logo: {
    kind: 'logo',
    label: 'Startup logo',
    maxBytes: 3 * MB,
    types: { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' },
    hint: 'PNG, JPG or WEBP · max 3 MB',
  },
  founderPhoto: {
    kind: 'founder-photo',
    label: "Founder's photo (passport size)",
    maxBytes: 3 * MB,
    types: { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' },
    hint: 'PNG, JPG or WEBP · max 3 MB',
  },
}
export const FILE_FIELDS = Object.keys(FILE_KINDS)
export const fileExt = (name) => String(name).split('.').pop().toLowerCase()
// null when acceptable, else a user-facing reason. `size` is optional so the server can reuse it for the extension alone.
export function fileProblem(field, { name, size }) {
  const rule = FILE_KINDS[field]
  if (!Object.hasOwn(rule.types, fileExt(name))) return `${rule.label}: ${rule.hint.split(' · ')[0]} only.`
  if (size !== undefined && !(size > 0)) return `${rule.label}: that file is empty.`
  if (size > rule.maxBytes) return `${rule.label}: file is too large (max ${rule.maxBytes / MB} MB).`
  return null
}

// Field limits, shared by the forms (maxLength) and the server (hard caps).
export const LIMITS = {
  name: 80, email: 254, campusText: 80, field: 80, semester: 20,
  startupName: 80, oneLiner: 140, description: 1500, website: 200,
  where: 120, registrationNumber: 60, role: 80,
}

// Validators shared by client and server.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const PHONE_RE = /^[6-9]\d{9}$/ // 10-digit Indian mobile
export const normalisePhone = (v) => String(v ?? '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')
export const isHttpUrl = (v) => {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.')
  } catch {
    return false
  }
}
