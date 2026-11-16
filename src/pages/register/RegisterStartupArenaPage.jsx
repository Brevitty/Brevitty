import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import RegisterShell, { fieldInput, primaryButton, ORANGE_ON_LIGHT, FieldError } from '../../components/register/RegisterShell.jsx'
import { Field, FileField } from '../../components/register/FormParts.jsx'
import ApplicantFields from '../../components/register/ApplicantFields.jsx'
import EligibilityGate from '../../components/register/EligibilityGate.jsx'
import DonePanel from '../../components/register/DonePanel.jsx'
import {
  REGISTRATION_OPTIONS,
  DECK_SECTIONS,
  DECK_FORMAT_NOTE,
  DECK_CONFIRM_LABEL,
  LIMITS,
  fileProblem,
} from '../../data/registrationOptions.js'
import { applicantErrors, applicantPayload, submitStartupArena } from '../../lib/registration.js'
import { useApplicant } from '../../lib/useApplicant.js'

const OPTION = REGISTRATION_OPTIONS['startup-arena']
const ARENA_FILES = ['pitchDeck', 'logo']

function validate(f, files) {
  const e = {}
  if (!f.startupName.trim()) e.startupName = 'Enter your startup name.'
  if (!f.oneLiner.trim()) e.oneLiner = 'Add a one-line description.'
  for (const field of ARENA_FILES) {
    const file = files[field]
    if (!file) e[field] = field === 'pitchDeck' ? 'Upload your pitch deck.' : 'Upload your startup logo.'
    else {
      const problem = fileProblem(field, file)
      if (problem) e[field] = problem
    }
  }
  if (!f.deckConfirmed) e.deckConfirmed = 'Please confirm your deck covers the 8 sections.'
  return e
}

// The brief every Startup Arena deck must follow, shown right above the upload.
function DeckFormatPanel() {
  return (
    <section aria-labelledby="deck-format-title" className="mt-4 rounded-2xl border border-orange/25 bg-gradient-to-b from-[#fff7ed] to-white p-5">
      <p id="deck-format-title" className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${ORANGE_ON_LIGHT}`}>
        Pitch deck format
      </p>
      <p className="mt-1.5 text-sm text-black/65">{DECK_FORMAT_NOTE}</p>
      <ol className="mt-4 space-y-3">
        {DECK_SECTIONS.map((section, i) => (
          <li key={section.title} className="flex gap-3">
            <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{section.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-black/60">{section.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

// Startup Arena is for students of the four campuses: the gate asks first, then the form below renders.
export default function RegisterStartupArenaPage() {
  return <EligibilityGate option="startup-arena">{(campus) => <ArenaForm campus={campus} />}</EligibilityGate>
}

function ArenaForm({ campus }) {
  const honeypot = useRef(null)
  const [applicant, patch] = useApplicant({ collegeStudent: 'Yes', campus })
  const [f, setF] = useState({ startupName: '', oneLiner: '', deckConfirmed: false })
  const [files, setFiles] = useState({ pitchDeck: null, logo: null })
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('idle') // idle | sending | done
  const [stepLabel, setStepLabel] = useState('')
  const [serverError, setServerError] = useState('')
  const [doneMessage, setDoneMessage] = useState('')

  const dropErrors = (...keys) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))))
  const changeApplicant = (changes) => {
    patch(changes)
    dropErrors(...Object.keys(changes))
    setServerError('')
  }
  const set = (patchF) => {
    setF((s) => ({ ...s, ...patchF }))
    dropErrors(...Object.keys(patchF))
    setServerError('')
  }
  const pickFile = (field, file) => {
    setFiles((s) => ({ ...s, [field]: file }))
    const problem = file ? fileProblem(field, file) : null
    setErrors((e) => ({ ...e, [field]: problem || undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (phase !== 'idle') return
    const found = { ...applicantErrors(applicant, { gated: true }), ...validate(f, files) }
    setErrors(found)
    setServerError('')
    if (Object.keys(found).some((k) => found[k])) return // nothing is uploaded unless every field is valid

    setPhase('sending')
    setStepLabel('Uploading your files…')
    const details = { startupName: f.startupName, oneLiner: f.oneLiner, deckConfirmed: true }
    const result = await submitStartupArena(applicantPayload(applicant, { gated: true }), details, files, honeypot.current?.value || '', setStepLabel)
    if (result.status === 'ok' || result.status === 'already') {
      setDoneMessage(result.status === 'ok' ? OPTION.success : result.message || "You're already registered for this one.")
      setPhase('done')
      return
    }
    setServerError(result.message || 'Something went wrong. Please try again.')
    setPhase('idle')
  }

  if (phase === 'done') return <DonePanel step={OPTION.title} message={doneMessage} />

  const sending = phase === 'sending'
  return (
    <RegisterShell wide step={OPTION.title} title="Pitch at the Startup Arena" intro="Tell us about yourself and your startup, and share your deck. Selected startups get a pitch slot.">
      <form noValidate onSubmit={submit} className="mx-auto max-w-2xl rounded-3xl border border-black/10 bg-white/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9">
        {/* honeypot: off-screen, not focusable, ignored by assistive tech */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </div>

        <ApplicantFields value={applicant} onChange={changeApplicant} errors={errors} gated />

        <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Your startup</p>
        <Field id="arena-name" label="Startup name" error={errors.startupName}>
          <input id="arena-name" value={f.startupName} maxLength={LIMITS.startupName} onChange={(e) => set({ startupName: e.target.value })} aria-invalid={Boolean(errors.startupName)} aria-describedby="arena-name-err" className={fieldInput} />
        </Field>
        <Field id="arena-oneliner" label="One-line description" error={errors.oneLiner}>
          <input id="arena-oneliner" value={f.oneLiner} maxLength={LIMITS.oneLiner} onChange={(e) => set({ oneLiner: e.target.value })} placeholder="What does it do, in one line?" aria-invalid={Boolean(errors.oneLiner)} aria-describedby="arena-oneliner-err" className={fieldInput} />
        </Field>

        <DeckFormatPanel />

        <FileField field="pitchDeck" file={files.pitchDeck} error={errors.pitchDeck} onPick={pickFile} hint="PDF recommended; PPT or PPTX also accepted · max 10 MB" />
        <FileField field="logo" file={files.logo} error={errors.logo} onPick={pickFile} />

        <div className="mt-3">
          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-black/15 bg-white px-3.5 py-3 text-sm text-ink focus-within:ring-4 focus-within:ring-orange/30">
            <input
              type="checkbox"
              checked={f.deckConfirmed}
              onChange={(e) => set({ deckConfirmed: e.target.checked })}
              aria-invalid={Boolean(errors.deckConfirmed)}
              aria-describedby="arena-confirm-err"
              className="mt-0.5 h-5 w-5 shrink-0 accent-orange"
            />
            <span>{DECK_CONFIRM_LABEL}</span>
          </label>
          <FieldError id="arena-confirm-err">{errors.deckConfirmed}</FieldError>
        </div>

        {/* server errors: nothing is confirmed unless the registration was actually saved */}
        <div role="alert" className="mt-1 min-h-[1.5rem] text-sm font-medium text-red-600">{serverError}</div>

        <div className="mt-2 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/register" className="text-center text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline">← Back to options</Link>
          <button type="submit" disabled={sending} className={primaryButton}>
            {sending ? stepLabel || 'Registering…' : 'Register'}
            {!sending && <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>}
          </button>
        </div>
      </form>
    </RegisterShell>
  )
}
