// Launchpad Abroad: phase + checklist + profile definitions, and the pure rules over them.
// Lives in code, not Sheets (the sheet only stores which item a student ticked). Imported by
// the client (views) AND the API (api/_lib/launchpadSheet.js validates item/field ids with it).
// No React, no I/O.

export const PHASES = [
  {
    id: 'ideate',
    n: '01',
    label: 'Ideate',
    blurb: 'Find a problem worth solving and pick an idea.',
    items: [
      { id: 'lp-problems', label: 'List 3 problems you have seen around you', hint: 'At school, at home, in your neighbourhood. Real, not trendy.', required: true },
      { id: 'lp-problem-pick', label: 'Pick one and write a one-line problem statement', hint: 'Who has it, and what it costs them.', required: true },
      { id: 'lp-idea', label: 'Describe your idea in two sentences', hint: 'Plain words. A friend should get it on the first read.', required: true },
      { id: 'lp-why-you', label: 'Write a short "why me" note', hint: 'Why you care about this problem. Admissions readers love this.', required: false },
      { id: 'lp-inspiration', label: 'Study 2 startups that tackled something similar', hint: 'What worked for them, and what you would do differently.', required: false },
    ],
  },
  {
    id: 'validate',
    n: '02',
    label: 'Validate',
    blurb: 'Talk to real people and test the idea before you build.',
    items: [
      { id: 'lp-interviews', label: 'Interview at least 10 people who have the problem', hint: 'Ask about their last time, not about your idea.', required: true },
      { id: 'lp-quotes', label: 'Log the 3 most surprising quotes', hint: 'Word for word. These end up in your essays.', required: true },
      { id: 'lp-survey', label: 'Run a short survey with 25+ responses', hint: 'Google Forms is fine. Five questions, max.', required: true },
      { id: 'lp-learnings', label: 'Write what changed in your thinking', hint: 'One paragraph: what you got wrong, what you kept.', required: true },
      { id: 'lp-landing', label: 'Put up a one-page landing page', hint: 'Optional, but sign-ups are the fastest signal you can get.', required: false },
    ],
  },
  {
    id: 'build',
    n: '03',
    label: 'Build',
    blurb: 'Make the smallest prototype that proves the idea.',
    items: [
      { id: 'lp-scope', label: 'Decide the smallest version that proves the idea', hint: 'Write what is in, what is out, and why.', required: true },
      { id: 'lp-prototype', label: 'Build a working prototype or MVP', hint: 'No-code, a spreadsheet, a paper version: whatever gets used.', required: true },
      { id: 'lp-demo', label: 'Record a 2-minute demo', hint: 'Screen recording or phone video. Link it in Documents.', required: true },
      { id: 'lp-testers', label: 'Get 5 testers to try it and note their feedback', hint: 'Watch them use it. Do not explain.', required: false },
    ],
  },
  {
    id: 'impact',
    n: '04',
    label: 'Prove Impact',
    blurb: 'First real users, measurable results, and people vouching for it.',
    items: [
      { id: 'lp-first-users', label: 'Reach your first 20 real users', hint: 'People outside your friends and family count double.', required: true },
      { id: 'lp-result', label: 'Measure one result that matters', hint: 'Time saved, money saved, grades up, waste down. One number.', required: true },
      { id: 'lp-testimonials', label: 'Collect 3 written testimonials', hint: 'Name, role, two sentences. Add them to Profile → Startup proof.', required: true },
      { id: 'lp-story', label: 'Write your impact story (300 words)', hint: 'The draft that becomes your activities essay.', required: true },
      { id: 'lp-featured', label: 'Get featured: newsletter, local press or a competition', hint: 'Optional, and a strong signal for admissions.', required: false },
    ],
  },
]

export const ALL_ITEMS = PHASES.flatMap((p) => p.items.map((it) => ({ ...it, phaseId: p.id })))
export const ITEM_IDS = new Set(ALL_ITEMS.map((it) => it.id))

// checked: { [item_id]: true }. A phase is done when its compulsory items are ticked AND every
// earlier phase is done; the first phase that isn't is "current"; everything after is "locked".
// Computed from the checklist only: there is no override anywhere.
export function phasesWithStatus(checked) {
  let blocked = false
  return PHASES.map((phase) => {
    const required = phase.items.filter((it) => it.required)
    const doneCount = required.filter((it) => checked[it.id]).length
    const complete = doneCount === required.length
    let status
    if (blocked) status = 'locked'
    else if (complete) status = 'done'
    else {
      status = 'current'
      blocked = true
    }
    return { ...phase, status, completion: { doneCount, totalCount: required.length } }
  })
}

// The phase the student is working in; null once all four are done.
export const currentPhase = (phases) => phases.find((p) => p.status === 'current') || null
export const allPhasesDone = (phases) => phases.every((p) => p.status === 'done')
// Profile Ready = Phase 4 done (so all four, by construction) AND the Launchpad team signed off.
export const isProfileReady = (phases, signoff) => allPhasesDone(phases) && Boolean(signoff?.profileReady)

export const tasksDone = (checked) => ALL_ITEMS.filter((it) => checked[it.id]).length

// First compulsory, unticked item of the current phase (what Overview shows as "next task").
export function nextTaskFor(phases, checked) {
  const phase = currentPhase(phases)
  if (!phase) return null
  const item = phase.items.find((it) => it.required && !checked[it.id])
  return item ? { ...item, phaseLabel: phase.label } : null
}

/* ---------------- Profile ---------------- */

// Text and links only (files live in Documents). `student` fields come from LP_Students, the
// rest from LP_Profile (email, section, field, value). The "startup" section is edited on
// My Journey → My Startup and shown read-only on Profile.
export const PROFILE_SECTIONS = [
  {
    id: 'about',
    n: '01',
    title: 'About me',
    fields: [
      { id: 'grade', label: 'Grade', source: 'student' },
      { id: 'school', label: 'School', source: 'student' },
      { id: 'interests', label: 'Interests', hint: 'Subjects, hobbies, causes. Comma-separated is fine.', kind: 'text' },
      { id: 'intended_major', label: 'Intended major', hint: 'What you hope to study abroad.', kind: 'text' },
    ],
  },
  {
    id: 'startup',
    n: '02',
    title: 'Startup summary',
    linked: true,
    fields: [
      { id: 'name', label: 'Startup name', kind: 'text' },
      { id: 'one_liner', label: 'One-liner', kind: 'text' },
      { id: 'problem', label: 'Problem', kind: 'textarea' },
      { id: 'solution', label: 'Solution', kind: 'textarea' },
    ],
  },
  {
    id: 'activities',
    n: '03',
    title: 'Activities & achievements',
    fields: [
      { id: 'activities', label: 'Activities', hint: 'One per line: role, organisation, years.', kind: 'textarea' },
      { id: 'achievements', label: 'Achievements', hint: 'One per line. Numbers beat adjectives.', kind: 'textarea' },
    ],
  },
  {
    id: 'awards',
    n: '04',
    title: 'Awards',
    fields: [{ id: 'awards', label: 'Awards & honours', hint: 'One per line: award, level, year.', kind: 'textarea' }],
  },
  {
    id: 'proof',
    n: '05',
    title: 'Startup proof',
    fields: [
      { id: 'demo_link', label: 'Demo link', kind: 'link' },
      { id: 'deck_link', label: 'Pitch deck link', kind: 'link' },
      { id: 'testimonials', label: 'Testimonials', hint: 'One per line: "quote" — name, role.', kind: 'textarea' },
    ],
  },
]

export const PROFILE_FIELD_KIND = Object.fromEntries(
  PROFILE_SECTIONS.flatMap((s) => s.fields.filter((f) => f.source !== 'student').map((f) => [`${s.id}.${f.id}`, f.kind]))
)
export const PROFILE_FIELD_MAX = { text: 200, link: 2000, textarea: 2000 }

// profile: { 'section.field': value }, student: { grade, school }. Every field counts once.
export function profileCompleteness(profile, student) {
  const all = PROFILE_SECTIONS.flatMap((s) => s.fields.map((f) => (f.source === 'student' ? student?.[f.id] : profile[`${s.id}.${f.id}`])))
  const filled = all.filter((v) => String(v ?? '').trim()).length
  return { filled, total: all.length, pct: Math.round((filled / all.length) * 100) }
}

/* ---------------- Documents ---------------- */

export const DOCUMENTS = [
  { id: 'resume', name: 'Resume / CV', hint: 'One page. Lead with the startup.' },
  { id: 'pitch-deck', name: 'Pitch deck', hint: '10–12 slides, shared as a view link.' },
  { id: 'recommendation-1', name: 'Recommendation letter 1', hint: 'From a teacher who knows your work.' },
  { id: 'recommendation-2', name: 'Recommendation letter 2', hint: 'From a user, community leader or industry contact.' },
  { id: 'certificates', name: 'Certificates', hint: 'One folder link with competition / course certificates.' },
  { id: 'startup-demo', name: 'Startup demo', hint: 'The 2-minute demo video or a live link.' },
]
export const DOCUMENT_IDS = new Set(DOCUMENTS.map((d) => d.id))

// Everything derived from one student's rows ({ checked, profile, student, signoff }), in one
// place, so Overview, the rail, the sidebar card, My Journey and the admin review never disagree.
export function deriveLaunchpad(data) {
  const phases = phasesWithStatus(data.checked)
  return {
    phases,
    current: currentPhase(phases),
    completeness: profileCompleteness(data.profile, data.student),
    profileReady: isProfileReady(phases, data.signoff),
  }
}

// The "Profile Ready" end node of the phase rail (StageRail's `seal` prop).
export function profileReadySeal(phases, profileReady, signoff) {
  const caption = profileReady
    ? `Signed off${signoff?.signedBy ? ` · ${signoff.signedBy.split(' ')[0]}` : ''}`
    : allPhasesDone(phases)
    ? 'Awaiting sign-off'
    : 'Locked'
  return { label: 'Profile Ready', unlocked: profileReady, caption }
}
