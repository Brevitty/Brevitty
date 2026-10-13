// Journey definitions: the stage / deliverable checklist (code, not data). What a student has ticked
// lives in the ChecklistStatus tab; the current stage is ALWAYS computed from it (see getStagesWithStatus),
// never stored. Profile, invoices and competitions come from the sheet via /api/hub/dashboard.

export const REVENUE_TARGET = 10000

export const getInvoiceTotal = (ledger) => ledger.reduce((sum, row) => sum + row.amount, 0)

export const STAGES = [
  {
    id: 'pre-ideation',
    n: '01',
    label: 'Pre-Ideation',
    deliverables: [
      { id: 'founder-profile', label: 'Founder profile & role', hint: 'Who you are and what you own on the team.', required: true },
      { id: 'problem-areas', label: 'Three problem areas you care about', hint: 'Pick from lived experience, not a trend list.', required: true },
      { id: 'team-agreement', label: 'Team working agreement', hint: 'Roles, equity split, and how you resolve disagreements.', required: false },
    ],
  },
  {
    id: 'ideation',
    n: '02',
    label: 'Ideation',
    deliverables: [
      { id: 'pitch-deck-draft', label: 'Pitch deck, 10–12 slides', hint: 'First draft — polish comes later.', required: true },
      { id: 'startup-description', label: 'Startup description', hint: 'Two or three sentences, plain language.', required: true },
      { id: 'problem-statement', label: 'Problem statement — one sentence', hint: 'Who has the problem, and what it costs them.', required: true },
      { id: 'solution-concept', label: 'Solution concept — business model canvas + sketch', hint: 'Rough is fine, this will change.', required: true },
      { id: 'competitor-scan', label: 'Competitor scan — 3 alternatives incl. doing nothing', hint: 'Include what people do today with no product at all.', required: false },
    ],
  },
  {
    id: 'validation',
    n: '03',
    label: 'Validation',
    deliverables: [
      { id: 'interview-log', label: 'Customer interview log, min 10, verbatim quotes', hint: 'Quote them directly — no paraphrasing.', required: true },
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
      { id: 'demo-video', label: 'Product demo video, 2–3 min', hint: 'Screen recording is fine.', required: true },
      { id: 'feature-scope', label: 'Feature list & scope — in/out and why', hint: 'What you cut matters as much as what you kept.', required: true },
      { id: 'first-users', label: 'First 5 users — feedback notes', hint: 'Real usage, not opinions on the idea.', required: true },
      { id: 'cost-sheet', label: 'Cost-to-build sheet', hint: 'Time + money spent so far.', required: false },
    ],
  },
  {
    id: 'first-customer',
    n: '05',
    label: 'First Customer',
    deliverables: [
      { id: 'paying-customer', label: 'First paying customer, logged in the ledger', hint: 'Any amount counts — this is about proof, not size.', required: true },
      { id: 'pricing-sheet', label: 'Pricing sheet & rationale', hint: 'Why this number, not a competitor benchmark.', required: true },
      { id: 'testimonial-one', label: 'One customer testimonial', hint: 'A sentence in their own words.', required: false },
    ],
  },
  {
    id: 'first-revenue',
    n: '06',
    label: 'First Revenue',
    deliverables: [
      { id: 'revenue-threshold', label: `Revenue of ₹${REVENUE_TARGET.toLocaleString('en-IN')}`, hint: 'Computed from your invoice ledger — no manual check needed.', required: true, computed: true },
      { id: 'unit-economics', label: 'Unit economics sheet — cost, price, margin', hint: 'Per-unit numbers, not totals.', required: true },
      { id: 'testimonials-three', label: 'Three customer testimonials', hint: 'Different customers, different angles.', required: false },
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
      { id: 'legal-cap-table', label: 'Cap table', hint: 'Carried forward — never blocks a stage.', required: false, group: 'legal' },
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

export const hasVerifiedCompetitionEntry = (competitions) =>
  competitions.some((c) => c.status === 'result' && c.proof.length > 0)
