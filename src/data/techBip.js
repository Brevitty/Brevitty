// Tech-BIP 2027 registration: every option, limit, message and validation rule. Imported by the page AND by
// api/_lib/techBip.js, so client and server can never disagree. Wording follows https://techbip.vedmap.com/register/
// except attribution, which is Brevitty's own (we collect these registrations; EDII organises the event).
import { EMAIL_RE, PHONE_RE, normalisePhone } from './registrationOptions.js'

export const TECH_BIP_FORM = 'tech-bip' // body.form value that routes /api/register to api/_lib/techBip.js
export const TECH_BIP_ROUTE = '/tech-bip-registration'
export const TECH_BIP_ALT_ROUTE = '/tech-bip-registeration' // common misspelling, redirected

/* ---------- copy ---------- */
export const COPY = {
  step: 'Tech-BIP 2027',
  title: 'Tech-BIP 2027 – Student Registration Form',
  intro:
    'The Entrepreneurship Development Institute of India (EDII), Ahmedabad, invites undergraduate students to participate in Tech-BIP 2027, a national-level Technology Business Idea Pitch Competition. Please provide accurate information.',
  teamNoteLabel: 'Team participation note:',
  teamNote:
    'Individual participation or teams of 2–5 members. For teams, more than 50% of members must be final-year undergraduate students. Only one member needs to fill this form on behalf of the team.',
  attribution: 'Tech-BIP 2027 is organised by EDII, Ahmedabad. Registrations on this page are collected by Brevitty.',
  storageNote: "Your details and ID cards are stored by Brevitty for this competition's registration.",
  contactEmail: 'techbip@ediindia.org',
  contactLine: 'Questions about the competition? Contact',
  cityNote: '(Note: City for institutional may change based on host university confirmations)',
  consent:
    'I confirm that I am an undergraduate student and that the information provided is accurate. I further confirm that the submitted idea is original to the best of my knowledge and agree to abide by the rules and selection process of Tech-BIP 2027.',
  submit: 'Submit Registration',
  success: 'Your Tech-BIP 2027 registration has been received. Keep your registration ID for any queries.',
  duplicate: 'This email is already registered for Tech-BIP 2027.',
}

export const SECTIONS = [
  { id: 'applicant', title: 'Primary Applicant Details', short: 'Applicant', help: 'The primary point of contact for all pitching and schedule notifications.' },
  { id: 'participation', title: 'Participation Type & Team Details', short: 'Participation', help: 'Pitch individually or bring a multidisciplinary team of 2 to 5 students.' },
  { id: 'idea', title: 'Business Idea & Pitching Location', short: 'Idea', help: 'Your innovation track and preferred city for the in-person institutional round.' },
  { id: 'documents', title: 'Student Verification Documents', short: 'Documents', help: 'Upload verification files to confirm undergraduate student standing.' },
]

export const LABELS = {
  name: 'Full Name',
  phone: 'Mobile Number',
  email: 'Email ID',
  college: 'Name of College / University',
  collegeCity: 'City of your University / College',
  finalYear: 'Are you final year student',
  participation: 'Participation Type',
  teamSize: 'Total Number of Team Members (Including you)',
  ideaTitle: 'Title of Business Idea',
  domain: 'Technology / Innovation Domain',
  city: 'In which city would you like to participate for Institutional / Regional round',
  idCards: 'Attach College/University Student Id card for all the participants',
}
export const PLACEHOLDERS = {
  name: 'e.g. Rahul Sharma',
  phone: '10-digit mobile number',
  email: 'e.g. name@college.edu or gmail.com',
  college: 'e.g. Nirma University, Ahmedabad',
  collegeCity: 'e.g. Ahmedabad, Surat, Pune',
  ideaTitle: 'e.g. Agriflux: AI-driven precision irrigation for dryland farmers',
  domain: 'Select your innovation domain / theme',
  city: 'Select preferred pitching city (26 Host Cities across 5 Zones)',
  dropzone: 'Click to browse or drag & drop combined ID Card PDF',
  dropzoneSub: 'Supported format: Single PDF up to 50MB',
  idCardsHelp: '(Combine all student ID cards into a single PDF document. Max file size: 50MB)',
}

/* ---------- options ---------- */
export const PARTICIPATION = ['Individual', 'Team']
export const TEAM_MIN = 2
export const TEAM_MAX = 5
export const TEAM_SIZES = Array.from({ length: TEAM_MAX - TEAM_MIN + 1 }, (_, i) => TEAM_MIN + i)
export const FINAL_YEAR = 'Final Year'
export const YEARS = [FINAL_YEAR, '3rd Year', '2nd Year', '1st Year']
export const DOMAINS = [
  'Artificial Intelligence', 'FinTech', 'HealthTech', 'AgriTech', 'Sustainability & CleanTech',
  'Industry 4.0', 'EdTech', 'Social Innovation', 'Rural Entrepreneurship', 'Any Innovative Tech-Driven Idea',
]
export const ZONES = {
  West: ['Ahmedabad', 'Goa', 'Mumbai', 'Pune', 'Vadodara'],
  South: ['Bengaluru', 'Chennai', 'Coimbatore', 'Hyderabad', 'Mangalore', 'Pondicherry', 'Vellore'],
  East: ['Bhubaneswar', 'Guwahati', 'Kolkata', 'Ranchi'],
  North: ['Chandigarh', 'Dehradun', 'Delhi', 'Gurgaon', 'Jaipur', 'Leh', 'Lucknow', 'Noida', 'Patna'],
  Central: ['Indore'],
}
export const CITY_ZONE = Object.fromEntries(Object.entries(ZONES).flatMap(([zone, cities]) => cities.map((c) => [c, zone])))

/* ---------- limits ---------- */
export const MAX_PDF_BYTES = 50 * 1024 * 1024
export const PDF_MAGIC = '%PDF'
export const PDF_MIME = 'application/pdf'
export const LIMITS = { name: 80, email: 254, phone: 20, college: 150, collegeCity: 80, ideaTitle: 150, filename: 200 }
export const BUCKET = 'techbip-ids'

/* ---------- team rule ---------- */
// More than 50% of ALL members (applicant included) must be final year: 2→2, 3→2, 4→3, 5→3.
export const requiredFinalYear = (teamSize) => Math.floor(teamSize / 2) + 1
export const finalYearCount = (v) =>
  (v.finalYear === 'Yes' ? 1 : 0) + (v.participation === 'Team' ? v.members.filter((m) => m.year === FINAL_YEAR).length : 0)
export const majorityMessage = (teamSize) =>
  `For a team of ${teamSize}, at least ${requiredFinalYear(teamSize)} members (including you) must be final-year students.`

/* ---------- normalise + validate (client and server) ---------- */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g
export const oneLine = (v, max) => (typeof v === 'string' ? v.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim() : '').slice(0, max)
const tooLong = (v, max) => typeof v === 'string' && v.trim().length > max

export const memberKey = (i, part) => `member-${i + 2}-${part}` // member rows are numbered from 2

// Shape: { name, phone, email, college, collegeCity, finalYear, participation, teamSize, members:[{name,year}],
//          ideaTitle, domain, city, consent }. Returns a clean copy (trimmed, phone normalised, members cut to size).
export function normaliseTechBip(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const team = r.participation === 'Team'
  const teamSize = team ? Number(r.teamSize) : 1
  const rawMembers = Array.isArray(r.members) ? r.members : []
  return {
    name: oneLine(r.name, LIMITS.name),
    phone: normalisePhone(oneLine(r.phone, LIMITS.phone)),
    email: oneLine(r.email, LIMITS.email).toLowerCase(),
    college: oneLine(r.college, LIMITS.college),
    collegeCity: oneLine(r.collegeCity, LIMITS.collegeCity),
    finalYear: r.finalYear === 'Yes' || r.finalYear === 'No' ? r.finalYear : '',
    participation: PARTICIPATION.includes(r.participation) ? r.participation : '',
    teamSize,
    members: team
      ? Array.from({ length: Number.isInteger(teamSize) ? Math.max(teamSize - 1, 0) : 0 }, (_, i) => ({
          name: oneLine(rawMembers[i]?.name, LIMITS.name),
          year: YEARS.includes(rawMembers[i]?.year) ? rawMembers[i].year : '',
        }))
      : [],
    ideaTitle: oneLine(r.ideaTitle, LIMITS.ideaTitle),
    domain: DOMAINS.includes(r.domain) ? r.domain : '',
    city: Object.hasOwn(CITY_ZONE, r.city) ? r.city : '',
    consent: r.consent === true,
  }
}

// -> { fieldKey: message } for a NORMALISED value. Empty object = valid. Keys match the form's field ids.
export function techBipErrors(v) {
  const e = {}
  if (v.name.length < 2) e.name = 'Enter your full name.'
  if (!PHONE_RE.test(v.phone)) e.phone = 'Enter a 10-digit mobile number.'
  if (!EMAIL_RE.test(v.email)) e.email = 'Enter a valid email address.'
  if (!v.college) e.college = 'Enter your college or university.'
  if (!v.collegeCity) e.collegeCity = 'Enter the city of your college.'
  if (!v.finalYear) e.finalYear = 'Tell us if you are a final year student.'
  if (!v.participation) e.participation = 'Choose Individual or Team.'
  if (v.participation === 'Team') {
    if (!Number.isInteger(v.teamSize) || v.teamSize < TEAM_MIN || v.teamSize > TEAM_MAX) e.teamSize = `Choose a team size from ${TEAM_MIN} to ${TEAM_MAX}.`
    v.members.forEach((m, i) => {
      if (m.name.length < 2) e[memberKey(i, 'name')] = 'Enter this member’s full name.'
      if (!m.year) e[memberKey(i, 'year')] = 'Choose their year.'
    })
    if (!e.teamSize && !e.finalYear && !v.members.some((m) => !m.year) && finalYearCount(v) < requiredFinalYear(v.teamSize)) {
      e.majority = majorityMessage(v.teamSize)
    }
  }
  if (!v.ideaTitle) e.ideaTitle = 'Enter the title of your business idea.'
  if (!v.domain) e.domain = 'Choose a domain.'
  if (!v.city) e.city = 'Choose a city.'
  if (!v.consent) e.consent = 'Please confirm to continue.'
  return e
}

// Raw (un-normalised) length guard: the server rejects over-long text instead of silently truncating it.
export const hasOverlongText = (r) =>
  [[r?.name, LIMITS.name], [r?.email, LIMITS.email], [r?.phone, LIMITS.phone], [r?.college, LIMITS.college],
    [r?.collegeCity, LIMITS.collegeCity], [r?.ideaTitle, LIMITS.ideaTitle],
    ...(Array.isArray(r?.members) ? r.members.map((m) => [m?.name, LIMITS.name]) : [])].some(([x, max]) => tooLong(x, max))

// Which section each error key belongs to (drives the rail ticks and first-invalid focus order).
export const SECTION_OF = (key) =>
  ['participation', 'teamSize', 'majority'].includes(key) || key.startsWith('member-') ? 'participation'
    : ['ideaTitle', 'domain', 'city'].includes(key) ? 'idea'
      : key === 'idCards' || key === 'consent' ? 'documents'
        : 'applicant'

/* ---------- PDF ---------- */
// Client-side check; the server re-checks size, type and the %PDF signature on the stored object.
export function pdfProblem(file) {
  if (!file) return 'Attach your combined ID card PDF.'
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== PDF_MIME)) return 'Only a PDF file is accepted.'
  if (file.size <= 0) return 'This file is empty.'
  if (file.size > MAX_PDF_BYTES) return 'This file is larger than 50 MB.'
  return null
}
