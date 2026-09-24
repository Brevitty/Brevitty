// Mock data for the "My Journey" feature (Home / My Startup / Competitions /
// Community). Flat objects/arrays only — no framework-specific magic — so a
// later Google Sheets-backed API swap only has to change how this module is
// populated, not any component logic.
//
// Competition deadlines/eligibility were checked against each programme's
// current 2026 cycle where public info was available; a couple carry a
// `deadlineNote` flagging where the exact date is set by a regional chapter
// or wasn't published yet — verify on the official URL before relying on it.

// TODO: replace with real API/Sheets call
export const JOURNEY_STUDENT = {
  startupName: 'Re-Loop',
  oneLiner: 'A campus marketplace for reselling textbooks and hostel gear.',
  description:
    'Re-Loop lets students list and buy used textbooks, cycles, and hostel gear within their own campus, cutting out random WhatsApp groups and DMs.',
  problem:
    'Students lose money and time reselling their stuff through scattered WhatsApp groups with no trust or discovery.',
  solution: 'A verified, campus-only marketplace with in-app chat and a simple listing flow.',
  product: 'A mobile-first web app where students list items in under a minute and browse by category and hostel block.',
  interviewsRun: 12,
}

export const REVENUE_TARGET = 10000

// TODO: replace with real API/Sheets call
export const INVOICE_LEDGER = [
  { customer: 'Priya (Hostel B)', amount: 1200, date: '2026-08-18', note: 'Sold: DS textbook set' },
  { customer: 'Rahul K', amount: 2800, date: '2026-08-27', note: 'Sold: bicycle' },
  { customer: 'Sneha M', amount: 1450, date: '2026-09-03', note: 'Sold: study table + rack' },
  { customer: 'Campus Store Co-op', amount: 2800, date: '2026-09-12', note: 'Bulk resale, 6 textbook sets' },
]

export const getInvoiceTotal = (ledger) => ledger.reduce((sum, row) => sum + row.amount, 0)

// TODO: replace with real API/Sheets call
export const STAGES = [
  {
    id: 'pre-ideation',
    n: '01',
    label: 'Pre-Ideation',
    deliverables: [
      { id: 'founder-profile', label: 'Founder profile & role', hint: 'Who you are and what you own on the team.', required: true, template: true },
      { id: 'problem-areas', label: 'Three problem areas you care about', hint: 'Pick from lived experience, not a trend list.', required: true },
      { id: 'team-agreement', label: 'Team working agreement', hint: 'Roles, equity split, and how you resolve disagreements.', required: false, template: true },
    ],
  },
  {
    id: 'ideation',
    n: '02',
    label: 'Ideation',
    deliverables: [
      { id: 'pitch-deck-draft', label: 'Pitch deck, 10–12 slides', hint: 'First draft — polish comes later.', required: true, template: true, sample: true },
      { id: 'startup-description', label: 'Startup description', hint: 'Two or three sentences, plain language.', required: true },
      { id: 'problem-statement', label: 'Problem statement — one sentence', hint: 'Who has the problem, and what it costs them.', required: true },
      { id: 'solution-concept', label: 'Solution concept — business model canvas + sketch', hint: 'Rough is fine, this will change.', required: true, template: true, sample: true },
      { id: 'competitor-scan', label: 'Competitor scan — 3 alternatives incl. doing nothing', hint: 'Include what people do today with no product at all.', required: false, template: true },
    ],
  },
  {
    id: 'validation',
    n: '03',
    label: 'Validation',
    deliverables: [
      { id: 'interview-log', label: 'Customer interview log, min 10, verbatim quotes', hint: 'Quote them directly — no paraphrasing.', required: true, template: true, sample: true },
      { id: 'fit-summary', label: 'Problem–solution fit summary', hint: 'What changed in your thinking after 10 interviews.', required: true },
      { id: 'landing-test', label: 'Landing page or concept test — live link + sign-ups', hint: 'Optional, but the fastest signal you can get.', required: false },
    ],
  },
  {
    id: 'mvp',
    n: '04',
    label: 'MVP',
    deliverables: [
      { id: 'product-summary', label: 'Our product — what it is and does', hint: 'One paragraph, no jargon.', required: true },
      { id: 'demo-video', label: 'Product demo video, 2–3 min', hint: 'Screen recording is fine.', required: true, sample: true },
      { id: 'feature-scope', label: 'Feature list & scope — in/out and why', hint: 'What you cut matters as much as what you kept.', required: true, template: true },
      { id: 'first-users', label: 'First 5 users — feedback notes', hint: 'Real usage, not opinions on the idea.', required: true, template: true },
      { id: 'cost-sheet', label: 'Cost-to-build sheet', hint: 'Time + money spent so far.', required: false, template: true },
    ],
  },
  {
    id: 'first-customer',
    n: '05',
    label: 'First Customer',
    deliverables: [
      { id: 'paying-customer', label: 'First paying customer, logged in the ledger', hint: 'Any amount counts — this is about proof, not size.', required: true },
      { id: 'pricing-sheet', label: 'Pricing sheet & rationale', hint: 'Why this number, not a competitor benchmark.', required: true, template: true, sample: true },
      { id: 'testimonial-one', label: 'One customer testimonial', hint: 'A sentence in their own words.', required: false, template: true },
    ],
  },
  {
    id: 'first-revenue',
    n: '06',
    label: 'First Revenue',
    deliverables: [
      { id: 'revenue-threshold', label: `Revenue of ₹${REVENUE_TARGET.toLocaleString('en-IN')}`, hint: 'Computed from your invoice ledger — no manual check needed.', required: true, computed: true },
      { id: 'unit-economics', label: 'Unit economics sheet — cost, price, margin', hint: 'Per-unit numbers, not totals.', required: true, template: true, sample: true },
      { id: 'testimonials-three', label: 'Three customer testimonials', hint: 'Different customers, different angles.', required: false, template: true },
    ],
  },
  {
    id: 'investment-ready',
    n: '07',
    label: 'Investment Ready',
    deliverables: [
      { id: 'competition-entry', label: 'One competition entry, verified — proof attached', hint: 'Computed from the Competitions tab.', required: true, computed: true },
      { id: 'demo-day-profile', label: 'Demo Day profile, completed and presented', hint: 'Your one-pager plus a 3-minute pitch.', required: true },
      { id: 'legal-incorporation', label: 'Certificate of incorporation', hint: 'Carried forward — never blocks a stage.', required: false, group: 'legal' },
      { id: 'legal-pan', label: 'PAN', hint: 'Carried forward — never blocks a stage.', required: false, group: 'legal' },
      { id: 'legal-bank', label: 'Business bank account', hint: 'Carried forward — never blocks a stage.', required: false, group: 'legal' },
      { id: 'legal-gst', label: 'GST registration', hint: 'Carried forward — never blocks a stage.', required: false, group: 'legal' },
      { id: 'legal-cap-table', label: 'Cap table', hint: 'Carried forward — never blocks a stage.', required: false, group: 'legal', template: true },
      { id: 'legal-trademark', label: 'Trademark/IP filing', hint: 'Carried forward — never blocks a stage.', required: false, group: 'legal' },
      { id: 'legal-data-room', label: 'Data room — one shared read-only folder', hint: 'Carried forward — never blocks a stage.', required: false, group: 'legal' },
    ],
  },
]

// All-false checklist state (every non-computed deliverable id) — the shape a
// student with no ChecklistStatus rows yet gets, before the API's checked
// rows are overlaid on top.
export function getDefaultChecklistState() {
  return Object.fromEntries(
    STAGES.flatMap((s) => s.deliverables)
      .filter((d) => !d.computed)
      .map((d) => [d.id, false])
  )
}

const isItemDone = (item, checklistState, ledgerTotal, hasVerifiedCompetition) => {
  if (item.id === 'revenue-threshold') return ledgerTotal >= REVENUE_TARGET
  if (item.id === 'competition-entry') return hasVerifiedCompetition
  return !!checklistState[item.id]
}

export function getStageCompletion(stage, checklistState, ledgerTotal, hasVerifiedCompetition) {
  const required = stage.deliverables.filter((d) => d.required)
  const doneCount = required.filter((d) => isItemDone(d, checklistState, ledgerTotal, hasVerifiedCompetition)).length
  return { doneCount, totalCount: required.length, isDone: required.length > 0 && doneCount === required.length }
}

// Derives each stage's done/current/locked status from live checklist state
// instead of storing a separate "current stage" field, so the two can never
// drift out of sync.
export function getStagesWithStatus(checklistState, ledgerTotal, hasVerifiedCompetition) {
  let currentAssigned = false
  return STAGES.map((stage) => {
    const completion = getStageCompletion(stage, checklistState, ledgerTotal, hasVerifiedCompetition)
    let status
    if (completion.isDone) status = 'done'
    else if (!currentAssigned) {
      status = 'current'
      currentAssigned = true
    } else status = 'locked'
    return { ...stage, status, completion }
  })
}

export const itemIsDone = isItemDone

// TODO: replace with real API/Sheets call
export const COMPETITIONS = [
  {
    id: 'conrad-challenge',
    name: 'Conrad Challenge',
    org: 'Conrad Foundation / Space Center Houston',
    about: 'Year-long innovation challenge — build a venture around a global problem, then pitch it like a real startup.',
    eligibility: 'Ages 13–18, high school or officially homeschooled, teams of 2–5.',
    eventDate: 'Apr 2027 · Innovation Summit (Houston, TX)',
    deadline: '2026-10-30',
    deadlineNote: null,
    prize: 'Seed funding, mentorship, and a trip to the Innovation Summit',
    url: 'https://conrad.spacecenter.org/',
    checklist: ['Register a team of 2–5 students', 'Submit an Executive Summary', 'Advance to build a full business plan + prototype'],
    status: 'open',
    saved: false,
    proof: [],
  },
  {
    id: 'diamond-challenge',
    name: 'Diamond Challenge',
    org: 'Horn Entrepreneurship, University of Delaware',
    about: 'Global pitch competition for original business or social venture concepts, with a $100K prize pool.',
    eligibility: 'Ages 14–18, any country, teams of 2–4 plus one adult advisor.',
    eventDate: 'Apr 2027 · Global Finals Summit (Delaware, US)',
    deadline: '2027-01-15',
    deadlineNote: 'Next cycle deadline is projected from last year\'s mid-January pattern — confirm the exact date on the official site.',
    prize: '$12,000 / $8,000 / $4,500 grand prizes per track',
    url: 'https://diamondchallenge.org/',
    checklist: ['Form a team + recruit an adult advisor', 'Submit your venture concept application', 'Advance to the video pitch round'],
    status: 'open',
    saved: true,
    proof: [],
  },
  {
    id: 'iris-national-fair',
    name: 'IRIS National Fair',
    org: 'Initiative for Research and Innovation in Science',
    about: 'India\'s top STEM research fair — original research or engineering projects with real experimental data.',
    eligibility: 'Classes 5–12, Indian students, solo or teams of exactly 2.',
    eventDate: 'Dec 2026 · National Fair (venue TBA)',
    deadline: '2026-10-03',
    deadlineNote: null,
    prize: 'National recognition + pathway to Regeneron ISEF',
    url: 'https://www.irisnationalfair.org/',
    checklist: ['Register your project + pay the entry fee', 'Submit experimental data (under 12 months old)', 'Present at the national fair if shortlisted'],
    status: 'open',
    saved: false,
    proof: [],
  },
  {
    id: 'tye-india',
    name: 'TiE Young Entrepreneurs (TYE)',
    org: 'TiE India (regional chapters)',
    about: 'A hands-on entrepreneurship cohort — weekly sessions building a real venture, ending in a chapter Demo Day.',
    eligibility: 'High school students, cohort-based, admission via your city\'s TiE chapter.',
    eventDate: 'Sep–Nov 2026 · Weekend sessions (chapter-dependent)',
    deadline: '2026-09-27',
    deadlineNote: 'Deadlines are set per regional chapter — check your city\'s TiE page before this date.',
    prize: 'Chapter Demo Day + a shot at the TYE Global Summit',
    url: 'https://events.tie.org/',
    checklist: ['Find and apply through your city\'s TiE chapter', 'Attend weekly Sunday sessions', 'Present at chapter Demo Day'],
    status: 'closed',
    saved: false,
    proof: [],
  },
  {
    id: 'youth-ideathon',
    name: 'Youth Ideathon',
    org: 'ThinkStartup × MEPSC, with IIT Delhi',
    about: 'India\'s largest school innovation competition — submit an idea, get shortlisted, pitch at the grand finale.',
    eligibility: 'Classes 8–12, any school in India, individual or team entries.',
    eventDate: '2026-12-15 · Grand Finale',
    deadline: '2026-11-01',
    deadlineNote: 'Submissions opened Jul 24, 2026 on a rolling basis — confirm the exact cutoff on the official site.',
    prize: '₹25 lakh in prizes across categories',
    url: 'https://youthideathon.in/',
    checklist: ['Register and get a Student ID (SID)', 'Submit your idea online', 'Get shortlisted for the grand finale pitch'],
    status: 'applied',
    saved: true,
    proof: ['idea-submission-screenshot.pdf'],
  },
]

export const hasVerifiedCompetitionEntry = (competitions) =>
  competitions.some((c) => c.status === 'result' && c.proof.length > 0)

// TODO: replace with real API/Sheets call
export const COMMUNITY_POSTS = [
  {
    id: 'post-1',
    tag: 'win',
    author: 'Aarav Mehta',
    startup: 'HostelHatti',
    time: '3 hours ago',
    body: 'Crossed our first ₹5,000 in laundry pickups this week — turns out nobody wants to walk to the machines at 11pm. Charging ₹20/bag flat.',
  },
  {
    id: 'post-2',
    tag: 'ask',
    author: 'Kavya Iyer',
    startup: 'NoteVault',
    time: 'Yesterday',
    body: 'Anyone cracked pricing for a notes-sharing app? We\'re torn between a flat ₹99/semester pass and pay-per-download. What worked for you?',
  },
  {
    id: 'post-3',
    tag: 'note',
    author: 'Dev Kulkarni',
    startup: 'TiffinRun',
    time: '2 days ago',
    body: 'Did 14 customer interviews this week instead of building. Three of them told us they\'d rather have a subscription than one-off orders — changed our whole roadmap.',
  },
  {
    id: 'post-4',
    tag: 'win',
    author: 'Ishaan Rao',
    startup: 'CampusCourt',
    time: '3 days ago',
    body: 'Booked our first paying college for badminton court slots. Small deal (₹1,500/month) but it\'s our first "yes" from someone who isn\'t a friend.',
  },
  {
    id: 'post-5',
    tag: 'ask',
    author: 'Meher Chawla',
    startup: 'StudyStack',
    time: '4 days ago',
    body: 'Building a demo video for the MVP stage — 2–3 min feels really short. Screen recording + voiceover, or should we actually appear on camera?',
  },
]

// TODO: replace with real API/Sheets call
export const COHORT_STATS = {
  cohortSize: 42,
  combinedRevenue: 418500,
}

// TODO: replace with real API/Sheets call
export const MOVED_THIS_WEEK = [
  { name: 'Aarav Mehta', startup: 'HostelHatti', toStage: 'First Customer' },
  { name: 'Priya Deshmukh', startup: 'GreenPlate', toStage: 'First Revenue' },
  { name: 'Ishaan Rao', startup: 'CampusCourt', toStage: 'First Customer' },
]
