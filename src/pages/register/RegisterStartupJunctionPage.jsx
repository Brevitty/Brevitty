import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import RegisterShell, { fieldLabel, fieldInput, primaryButton, FieldError } from '../../components/register/RegisterShell.jsx'
import {
  REGISTRATION_OPTIONS,
  STAGES,
  isFullStage,
  INDUSTRIES,
  NOT_REGISTERED,
  REGISTERED_WITH,
  MAX_TEAM_SIZE,
  FILE_KINDS,
  FILE_FIELDS,
  LIMITS,
  fileProblem,
  isHttpUrl,
} from '../../data/registrationOptions.js'
import {
  loadRegistration,
  markDone,
  submitStartupJunction,
  hasStep1,
  hasStep2,
  isVerifiedPath,
  isEmail,
  isPhone,
} from '../../lib/registration.js'

const OPTION = REGISTRATION_OPTIONS['startup-junction']
const EMPTY_MEMBER = { name: '', mobile: '' }
const INITIAL = {
  stage: '', startupName: '', oneLiner: '', industry: '', description: '', startupEmail: '', website: '',
  incubatedElsewhere: '', incubatedWhere: '', registeredWith: '', registrationNumber: '', founderRole: '', teamSize: '1',
}
const formatMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`

function validate(f, files, team) {
  const e = {}
  if (!f.stage) e.stage = 'Choose your stage.'
  if (!isFullStage(f.stage)) return e // stages 1-2: Startup Name and one-liner are optional
  if (!f.startupName.trim()) e.startupName = 'Enter your startup name.'
  if (!f.oneLiner.trim()) e.oneLiner = 'Add a one-line description.'
  if (!f.industry) e.industry = 'Choose an industry.'
  if (!f.description.trim()) e.description = 'Describe your startup or idea.'
  if (!isEmail(f.startupEmail)) e.startupEmail = 'Enter a valid email address.'
  if (f.website.trim() && !isHttpUrl(f.website.trim())) e.website = 'Enter a valid website, e.g. https://example.com'
  for (const field of FILE_FIELDS) {
    const file = files[field]
    if (!file) e[field] = `Upload your ${FILE_KINDS[field].label.toLowerCase()}.`
    else {
      const problem = fileProblem(field, file)
      if (problem) e[field] = problem
    }
  }
  if (!f.incubatedElsewhere) e.incubatedElsewhere = 'Choose Yes or No.'
  if (f.incubatedElsewhere === 'Yes' && !f.incubatedWhere.trim()) e.incubatedWhere = 'Tell us where.'
  if (!f.registeredWith) e.registeredWith = 'Choose an option.'
  if (f.registeredWith && f.registeredWith !== NOT_REGISTERED && !f.registrationNumber.trim()) e.registrationNumber = 'Enter your registration number.'
  if (!f.founderRole.trim()) e.founderRole = 'Enter your role.'
  const members = Number(f.teamSize) - 1
  team.slice(0, members).forEach((m, i) => {
    if (m.name.trim().length < 2) e[`team${i}name`] = 'Enter a name.'
    if (!isPhone(m.mobile)) e[`team${i}mobile`] = 'Enter a 10-digit mobile number.'
  })
  return e
}

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className={`${fieldLabel} mt-2`}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-black/50">{hint}</p>}
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  )
}

function FileField({ field, file, error, onPick }) {
  const rule = FILE_KINDS[field]
  const id = `sj-${field}`
  return (
    <Field id={id} label={rule.label} error={error} hint={rule.hint}>
      <div className="mt-1.5 flex min-h-[48px] items-center gap-3 rounded-xl border border-black/20 bg-white px-3 py-2">
        <label
          htmlFor={id}
          className="cursor-pointer rounded-full bg-orange/10 px-4 py-2 text-sm font-semibold text-[#c2410c] focus-within:ring-4 focus-within:ring-orange/30 hover:bg-orange/20"
        >
          {file ? 'Replace' : 'Choose file'}
        </label>
        <input
          id={id}
          type="file"
          className="sr-only"
          accept={Object.keys(rule.types).map((x) => `.${x}`).join(',')}
          onChange={(e) => onPick(field, e.target.files?.[0] || null)}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-err`}
        />
        <span className="min-w-0 flex-1 truncate text-sm text-black/60">
          {file ? `${file.name} · ${formatMb(file.size)}` : 'No file chosen'}
        </span>
        {file && (
          <button type="button" onClick={() => onPick(field, null)} className="text-xs font-semibold text-black/50 hover:text-ink" aria-label={`Remove ${rule.label}`}>
            Remove
          </button>
        )}
      </div>
    </Field>
  )
}

export default function RegisterStartupJunctionPage() {
  const saved = loadRegistration()
  const honeypot = useRef(null)
  const [f, setF] = useState(INITIAL)
  const [files, setFiles] = useState({ pitchDeck: null, logo: null, founderPhoto: null })
  const [team, setTeam] = useState(() => Array.from({ length: MAX_TEAM_SIZE - 1 }, () => ({ ...EMPTY_MEMBER })))
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('idle') // idle | sending | done
  const [stepLabel, setStepLabel] = useState('')
  const [serverError, setServerError] = useState('')
  const [doneMessage, setDoneMessage] = useState('')

  // Verified campus students who finished Step 2 only; everyone else is sent back to where they belong.
  if (!hasStep1(saved) || !isVerifiedPath(saved)) return <Navigate to="/register" replace />
  if (!hasStep2(saved)) return <Navigate to="/register/details" replace />

  const full = isFullStage(f.stage)
  const members = Math.max(0, Math.min(MAX_TEAM_SIZE, Number(f.teamSize)) - 1)
  const clear = (...keys) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))))
  const set = (patch) => {
    setF((s) => ({ ...s, ...patch }))
    clear(...Object.keys(patch))
    setServerError('')
  }
  const pickFile = (field, file) => {
    setFiles((s) => ({ ...s, [field]: file }))
    const problem = file ? fileProblem(field, file) : null
    setErrors((e) => ({ ...e, [field]: problem || undefined }))
  }
  const setMember = (i, patch) => {
    setTeam((t) => t.map((m, j) => (j === i ? { ...m, ...patch } : m)))
    clear(...Object.keys(patch).map((k) => `team${i}${k}`))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (phase !== 'idle') return
    const found = validate(f, files, team)
    setErrors(found)
    setServerError('')
    if (Object.keys(found).some((k) => found[k])) return // nothing is uploaded unless every field is valid

    const sj = full
      ? {
          stage: f.stage, startupName: f.startupName, oneLiner: f.oneLiner, industry: f.industry, description: f.description,
          startupEmail: f.startupEmail, website: f.website, incubatedElsewhere: f.incubatedElsewhere, incubatedWhere: f.incubatedWhere,
          registeredWith: f.registeredWith, registrationNumber: f.registrationNumber, founderRole: f.founderRole,
          teamSize: Number(f.teamSize), team: team.slice(0, members),
        }
      : { stage: f.stage, startupName: f.startupName, oneLiner: f.oneLiner }

    setPhase('sending')
    setStepLabel(full ? 'Uploading your files…' : 'Saving your registration…')
    const result = await submitStartupJunction(saved, sj, full ? files : {}, honeypot.current?.value || '', setStepLabel)
    if (result.status === 'ok' || result.status === 'already') {
      markDone('startup-junction')
      setDoneMessage(result.status === 'ok' ? OPTION.success : result.message || "You're already registered for this one.")
      setPhase('done')
      return
    }
    setServerError(result.message || 'Something went wrong. Please try again.')
    setPhase('idle')
  }

  if (phase === 'done') {
    return (
      <RegisterShell step="Startup Junction" title="All set">
        <div role="status" className="rounded-3xl border border-black/10 bg-white/90 p-7 text-center shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9">
          <p className="text-base font-medium text-green-700">{doneMessage}</p>
          <Link to="/register/student" className={`${primaryButton} mt-6`}>Back to options</Link>
        </div>
      </RegisterShell>
    )
  }

  const sending = phase === 'sending'
  const err = (k) => errors[k]
  return (
    <RegisterShell wide step="Startup Junction" title="Tell us about your startup" intro="Early-stage? Just pick your stage. Already building? Share a few more details.">
      <form noValidate onSubmit={submit} className="mx-auto max-w-2xl rounded-3xl border border-black/10 bg-white/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9">
        {/* honeypot: off-screen, not focusable, ignored by assistive tech */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </div>

        <Field id="sj-stage" label="Stage" error={err('stage')}>
          <select id="sj-stage" value={f.stage} onChange={(e) => set({ stage: e.target.value })} aria-invalid={Boolean(err('stage'))} aria-describedby="sj-stage-err" className={fieldInput}>
            <option value="">Select your stage</option>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.value}</option>)}
          </select>
        </Field>

        {f.stage && (
          <>
            <Field id="sj-name" label={`Startup name${full ? '' : ' (optional)'}`} error={err('startupName')}>
              <input id="sj-name" value={f.startupName} maxLength={LIMITS.startupName} onChange={(e) => set({ startupName: e.target.value })} aria-invalid={Boolean(err('startupName'))} aria-describedby="sj-name-err" className={fieldInput} />
            </Field>
            <Field id="sj-oneliner" label={`One-line description${full ? '' : ' (optional)'}`} error={err('oneLiner')}>
              <input id="sj-oneliner" value={f.oneLiner} maxLength={LIMITS.oneLiner} onChange={(e) => set({ oneLiner: e.target.value })} placeholder="What does it do, in one line?" aria-invalid={Boolean(err('oneLiner'))} aria-describedby="sj-oneliner-err" className={fieldInput} />
            </Field>
          </>
        )}

        {full && (
          <>
            <Field id="sj-industry" label="Industry" error={err('industry')}>
              <select id="sj-industry" value={f.industry} onChange={(e) => set({ industry: e.target.value })} aria-invalid={Boolean(err('industry'))} aria-describedby="sj-industry-err" className={fieldInput}>
                <option value="">Select an industry</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field id="sj-description" label="Startup / idea description" error={err('description')}>
              <textarea id="sj-description" rows={5} value={f.description} maxLength={LIMITS.description} onChange={(e) => set({ description: e.target.value })} aria-invalid={Boolean(err('description'))} aria-describedby="sj-description-err" className={`${fieldInput} resize-y`} />
            </Field>
            <Field id="sj-email" label="Startup email" error={err('startupEmail')}>
              <input id="sj-email" type="email" inputMode="email" value={f.startupEmail} maxLength={LIMITS.email} onChange={(e) => set({ startupEmail: e.target.value })} aria-invalid={Boolean(err('startupEmail'))} aria-describedby="sj-email-err" className={fieldInput} />
            </Field>
            <Field id="sj-website" label="Website (optional)" error={err('website')}>
              <input id="sj-website" inputMode="url" value={f.website} maxLength={LIMITS.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" aria-invalid={Boolean(err('website'))} aria-describedby="sj-website-err" className={fieldInput} />
            </Field>

            <FileField field="pitchDeck" file={files.pitchDeck} error={err('pitchDeck')} onPick={pickFile} />
            <FileField field="logo" file={files.logo} error={err('logo')} onPick={pickFile} />

            <Field id="sj-incubated" label="Incubated anywhere else?" error={err('incubatedElsewhere')}>
              <select id="sj-incubated" value={f.incubatedElsewhere} onChange={(e) => set({ incubatedElsewhere: e.target.value, ...(e.target.value !== 'Yes' ? { incubatedWhere: '' } : {}) })} aria-invalid={Boolean(err('incubatedElsewhere'))} aria-describedby="sj-incubated-err" className={fieldInput}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </Field>
            {f.incubatedElsewhere === 'Yes' && (
              <Field id="sj-where" label="Where?" error={err('incubatedWhere')}>
                <input id="sj-where" value={f.incubatedWhere} maxLength={LIMITS.where} onChange={(e) => set({ incubatedWhere: e.target.value })} aria-invalid={Boolean(err('incubatedWhere'))} aria-describedby="sj-where-err" className={fieldInput} />
              </Field>
            )}

            <Field id="sj-registered" label="Is your startup registered?" error={err('registeredWith')}>
              <select id="sj-registered" value={f.registeredWith} onChange={(e) => set({ registeredWith: e.target.value, ...(e.target.value === NOT_REGISTERED ? { registrationNumber: '' } : {}) })} aria-invalid={Boolean(err('registeredWith'))} aria-describedby="sj-registered-err" className={fieldInput}>
                <option value="">Select</option>
                {REGISTERED_WITH.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            {f.registeredWith && f.registeredWith !== NOT_REGISTERED && (
              <Field id="sj-regno" label="Registration number" error={err('registrationNumber')}>
                <input id="sj-regno" value={f.registrationNumber} maxLength={LIMITS.registrationNumber} onChange={(e) => set({ registrationNumber: e.target.value })} aria-invalid={Boolean(err('registrationNumber'))} aria-describedby="sj-regno-err" className={fieldInput} />
              </Field>
            )}

            <FileField field="founderPhoto" file={files.founderPhoto} error={err('founderPhoto')} onPick={pickFile} />
            <Field id="sj-role" label="Your role" error={err('founderRole')}>
              <input id="sj-role" value={f.founderRole} maxLength={LIMITS.role} onChange={(e) => set({ founderRole: e.target.value })} placeholder="e.g. Founder & CEO" aria-invalid={Boolean(err('founderRole'))} aria-describedby="sj-role-err" className={fieldInput} />
            </Field>
            <Field id="sj-team" label="Team size (including you)" error={err('teamSize')}>
              <select id="sj-team" value={f.teamSize} onChange={(e) => set({ teamSize: e.target.value })} className={fieldInput}>
                {Array.from({ length: MAX_TEAM_SIZE }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>

            {Array.from({ length: members }, (_, i) => (
              <fieldset key={i} className="mt-2 rounded-2xl border border-black/10 p-4">
                <legend className="px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/60">Team member {i + 1}</legend>
                <Field id={`sj-tm${i}-name`} label="Name" error={err(`team${i}name`)}>
                  <input id={`sj-tm${i}-name`} value={team[i].name} maxLength={LIMITS.name} onChange={(e) => setMember(i, { name: e.target.value })} aria-invalid={Boolean(err(`team${i}name`))} aria-describedby={`sj-tm${i}-name-err`} className={fieldInput} />
                </Field>
                <Field id={`sj-tm${i}-mobile`} label="Mobile number" error={err(`team${i}mobile`)}>
                  <input id={`sj-tm${i}-mobile`} type="tel" inputMode="numeric" maxLength={14} value={team[i].mobile} onChange={(e) => setMember(i, { mobile: e.target.value })} aria-invalid={Boolean(err(`team${i}mobile`))} aria-describedby={`sj-tm${i}-mobile-err`} className={fieldInput} />
                </Field>
              </fieldset>
            ))}
          </>
        )}

        {/* server errors: nothing is confirmed unless the registration was actually saved */}
        <div role="alert" className="mt-3 min-h-[1.5rem] text-sm font-medium text-red-600">{serverError}</div>

        <div className="mt-2 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/register/student" className="text-center text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline">← Back</Link>
          <button type="submit" disabled={sending || !f.stage} className={primaryButton}>
            {sending ? stepLabel || 'Registering…' : 'Register'}
            {!sending && <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>}
          </button>
        </div>
      </form>
    </RegisterShell>
  )
}
