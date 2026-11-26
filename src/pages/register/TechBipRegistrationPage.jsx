import { useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import RegisterShell, { fieldInput, primaryButton, ORANGE_ON_LIGHT, FieldError } from '../../components/register/RegisterShell.jsx'
import { Field } from '../../components/register/FormParts.jsx'
import DonePanel from '../../components/register/DonePanel.jsx'
import PdfDropZone from '../../components/register/PdfDropZone.jsx'
import {
  COPY, SECTIONS, LABELS, PLACEHOLDERS, PARTICIPATION, TEAM_SIZES, TEAM_MAX, YEARS, DOMAINS, ZONES, LIMITS,
  FINAL_YEAR, requiredFinalYear, finalYearCount, memberKey, normaliseTechBip, techBipErrors, pdfProblem, SECTION_OF,
} from '../../data/techBip.js'
import { submitTechBip } from '../../lib/techBip.js'

const CARD = 'rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-8'
const SECTION_STAGGER_S = 0.08
const NAVBAR_PX = 64 // fixed navbar height (h-16); the mobile progress bar sticks right below it

const EMPTY = {
  name: '', phone: '', email: '', college: '', collegeCity: '', finalYear: '',
  participation: '', teamSize: '', members: Array.from({ length: TEAM_MAX - 1 }, () => ({ name: '', year: '' })),
  ideaTitle: '', domain: '', city: '', consent: false,
}
// Order the form is read in: the first error in this order gets scrolled to and focused.
const FIELD_ORDER = [
  'name', 'phone', 'email', 'college', 'collegeCity', 'finalYear', 'participation', 'teamSize',
  ...Array.from({ length: TEAM_MAX - 1 }, (_, i) => [memberKey(i, 'name'), memberKey(i, 'year')]).flat(),
  'majority', 'ideaTitle', 'domain', 'city', 'idCards', 'consent',
]

// Radio pills built on native radios: arrow keys, focus ring and screen-reader semantics come for free.
function Pills({ id, name, label, options, value, onChange, invalid }) {
  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} className="mt-1.5 flex gap-3">
      {options.map((opt, i) => (
        <label
          key={opt}
          className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center rounded-full border border-black/20 bg-white px-6 text-sm font-semibold text-ink transition-colors hover:border-black/40 has-[:checked]:border-orange has-[:checked]:bg-[#fff7ed] has-[:checked]:text-[#c2410c] has-[:checked]:ring-1 has-[:checked]:ring-orange has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-orange/30"
        >
          <input type="radio" className="sr-only" id={i === 0 ? id : undefined} name={name} value={opt} checked={value === opt} onChange={() => onChange(opt)} />
          {opt}
        </label>
      ))}
    </div>
  )
}

function TextField({ k, type = 'text', value, errors, set, maxLength, autoComplete, inputMode, disabled }) {
  const id = `tb-${k}`
  return (
    <Field id={id} label={LABELS[k]} error={errors[k]}>
      <input
        id={id} type={type} value={value} maxLength={maxLength} autoComplete={autoComplete} inputMode={inputMode} disabled={disabled}
        placeholder={PLACEHOLDERS[k]} onChange={(e) => set({ [k]: e.target.value })}
        aria-invalid={Boolean(errors[k])} aria-describedby={`${id}-err`} aria-required="true" className={fieldInput}
      />
    </Field>
  )
}

function SectionCard({ index, section, reduce, children }) {
  return (
    <motion.section
      id={`tb-section-${section.id}`}
      aria-labelledby={`tb-h-${section.id}`}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: reduce ? 0 : 0.15 + index * SECTION_STAGGER_S, ease: [0.22, 1, 0.36, 1] }}
      className={`${CARD} scroll-mt-36 lg:scroll-mt-28`}
    >
      <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${ORANGE_ON_LIGHT}`}>Step {index + 1} of {SECTIONS.length}</p>
      <h2 id={`tb-h-${section.id}`} className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">{section.title}</h2>
      <p className="mt-1 text-sm text-black/60">{section.help}</p>
      <div className="mt-4">{children}</div>
    </motion.section>
  )
}

// The signature element: one row per team member plus a live "final-year members" meter.
function Roster({ form, norm, errors, setMember }) {
  const size = norm.teamSize
  const need = requiredFinalYear(size)
  const have = Math.min(finalYearCount(norm), size)
  const met = have >= need
  const youBadge = form.finalYear === 'Yes' ? FINAL_YEAR : form.finalYear === 'No' ? 'Not final year' : 'Answer above'
  return (
    <div className="mt-2">
      <ul className="space-y-3">
        <li className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3.5 py-2">
          <span className="min-w-0 truncate text-sm font-semibold text-ink">1. {form.name.trim() || 'You'} <span className="font-normal text-black/50">(primary applicant)</span></span>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${form.finalYear === 'Yes' ? 'bg-orange/15 text-[#c2410c]' : 'bg-black/5 text-black/60'}`}>{youBadge}</span>
        </li>
        {norm.members.map((_, i) => {
          const nameId = `tb-${memberKey(i, 'name')}`
          const yearId = `tb-${memberKey(i, 'year')}`
          const m = form.members[i]
          return (
            <li key={i} className="grid gap-x-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Field id={nameId} label={`Member ${i + 2} · Full Name`} error={errors[memberKey(i, 'name')]}>
                <input id={nameId} value={m.name} maxLength={LIMITS.name} onChange={(e) => setMember(i, { name: e.target.value })} autoComplete="off"
                  placeholder="Full name" aria-invalid={Boolean(errors[memberKey(i, 'name')])} aria-describedby={`${nameId}-err`} aria-required="true" className={fieldInput} />
              </Field>
              <Field id={yearId} label={`Member ${i + 2} · Year`} error={errors[memberKey(i, 'year')]}>
                <select id={yearId} value={m.year} onChange={(e) => setMember(i, { year: e.target.value })}
                  aria-invalid={Boolean(errors[memberKey(i, 'year')])} aria-describedby={`${yearId}-err`} aria-required="true" className={fieldInput}>
                  <option value="">Select year</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
            </li>
          )
        })}
      </ul>
      <div id="tb-majority" tabIndex={-1} className="mt-3 rounded-2xl border border-black/10 bg-white p-4 outline-none focus-visible:ring-4 focus-visible:ring-orange/30">
        <p role="status" aria-live="polite" className={`text-sm font-semibold ${met ? ORANGE_ON_LIGHT : 'text-amber-700'}`}>
          Final-year members: {have} of {size} (need {need})
        </p>
        <div aria-hidden="true" className="mt-2 flex gap-1.5">
          {Array.from({ length: size }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full transition-colors ${i < have ? (met ? 'bg-orange' : 'bg-amber-500') : 'bg-black/10'}`} />
          ))}
        </div>
        <FieldError id="tb-majority-err">{errors.majority}</FieldError>
      </div>
    </div>
  )
}

export default function TechBipRegistrationPage() {
  const reduce = useReducedMotion()
  const honeypot = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [attempted, setAttempted] = useState(false)
  const [serverFieldErrors, setServerFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [phase, setPhase] = useState('idle') // idle | uploading | saving | done
  const [progress, setProgress] = useState(null)
  const [registrationId, setRegistrationId] = useState('')

  const norm = useMemo(() => normaliseTechBip(form), [form])
  const all = useMemo(() => {
    const e = techBipErrors(norm)
    const p = pdfProblem(file)
    return p ? { ...e, idCards: p } : e
  }, [norm, file])
  const errors = attempted ? { ...all, ...serverFieldErrors } : {}
  const sectionDone = Object.fromEntries(SECTIONS.map((s) => [s.id, !Object.keys(all).some((k) => SECTION_OF(k) === s.id)]))
  const doneCount = SECTIONS.filter((s) => sectionDone[s.id]).length

  const set = (changes) => {
    setForm((f) => ({ ...f, ...changes }))
    if ('email' in changes) setServerFieldErrors({})
    setServerError('')
  }
  const setMember = (i, changes) => {
    setForm((f) => ({ ...f, members: f.members.map((m, j) => (j === i ? { ...m, ...changes } : m)) }))
    setServerError('')
  }

  const goto = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  const focusField = (key) => {
    const el = document.getElementById(`tb-${key}`)
    if (!el) return
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (phase !== 'idle') return
    setAttempted(true)
    setServerError('')
    const firstBad = FIELD_ORDER.find((k) => all[k])
    if (firstBad) return focusField(firstBad) // inputs are never cleared on a failed submit

    setServerFieldErrors({})
    const result = await submitTechBip(norm, file, honeypot.current?.value || '', {
      onStage: (s) => setPhase(s),
      onProgress: setProgress,
    })
    setProgress(null)
    if (result.status === 'ok') {
      setRegistrationId(result.data?.registrationId || '')
      setPhase('done')
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    setPhase('idle')
    if (result.status === 'already') {
      setServerFieldErrors({ email: result.message })
      return focusField('email')
    }
    setServerError(result.message)
  }

  if (phase === 'done') {
    return (
      <DonePanel
        step={COPY.step}
        title="Registration received"
        message={<>{COPY.success}<span className="mt-3 block font-mono text-xl font-bold tracking-wider text-ink">{registrationId}</span></>}
      />
    )
  }

  const busy = phase !== 'idle'
  const team = norm.participation === 'Team'
  return (
    <RegisterShell
      clip
      wide
      widthClass="max-w-5xl"
      step={COPY.step}
      title={COPY.title}
      intro={<>{COPY.intro}<span className="mt-3 block text-xs text-black/55">{COPY.attribution}</span></>}
    >
      {/* Mobile: slim sticky progress bar under the navbar */}
      <div style={{ top: NAVBAR_PX }} className="sticky z-30 -mx-6 mb-6 border-y border-black/10 bg-white/90 px-6 py-2.5 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between text-xs font-semibold text-ink">
          <span>{doneCount} of {SECTIONS.length} sections complete</span>
          <span className="flex gap-1.5" aria-hidden="true">
            {SECTIONS.map((s) => <span key={s.id} className={`h-2 w-6 rounded-full ${sectionDone[s.id] ? 'bg-orange' : 'bg-black/10'}`} />)}
          </span>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        {/* Desktop: sticky section rail */}
        <aside className="hidden lg:block">
          <nav aria-label="Form sections" className="sticky top-28">
            <ol className="space-y-1">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <button type="button" onClick={() => goto(`tb-section-${s.id}`)} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-semibold text-ink outline-none hover:bg-black/5 focus-visible:ring-4 focus-visible:ring-orange/30">
                    <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${sectionDone[s.id] ? 'border-orange bg-orange text-white' : 'border-black/25 bg-white text-black/60'}`}>
                      {sectionDone[s.id] ? '✓' : i + 1}
                    </span>
                    <span>{s.short}{sectionDone[s.id] && <span className="sr-only"> (complete)</span>}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <form noValidate onSubmit={submit} className="space-y-6">
          {/* honeypot: off-screen, not focusable, ignored by assistive tech */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
          </div>

          <div className="rounded-2xl border border-orange/25 bg-gradient-to-b from-[#fff7ed] to-white p-4 text-sm text-black/70">
            <span className={`font-semibold ${ORANGE_ON_LIGHT}`}>{COPY.teamNoteLabel}</span> {COPY.teamNote}
          </div>

          <SectionCard index={0} section={SECTIONS[0]} reduce={reduce}>
            <TextField k="name" value={form.name} errors={errors} set={set} maxLength={LIMITS.name} autoComplete="name" />
            <TextField k="phone" type="tel" inputMode="numeric" value={form.phone} errors={errors} set={set} maxLength={LIMITS.phone} autoComplete="tel" />
            <TextField k="email" type="email" value={form.email} errors={errors} set={set} maxLength={LIMITS.email} autoComplete="email" />
            <TextField k="college" value={form.college} errors={errors} set={set} maxLength={LIMITS.college} autoComplete="organization" />
            <TextField k="collegeCity" value={form.collegeCity} errors={errors} set={set} maxLength={LIMITS.collegeCity} />
            <div>
              <p id="tb-finalYear-label" className="mt-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/60">{LABELS.finalYear}</p>
              <Pills id="tb-finalYear" name="finalYear" label={LABELS.finalYear} options={['Yes', 'No']} value={form.finalYear} onChange={(v) => set({ finalYear: v })} invalid={Boolean(errors.finalYear)} />
              <FieldError id="tb-finalYear-err">{errors.finalYear}</FieldError>
            </div>
          </SectionCard>

          <SectionCard index={1} section={SECTIONS[1]} reduce={reduce}>
            <div>
              <p className="mt-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/60">{LABELS.participation}</p>
              <Pills id="tb-participation" name="participation" label={LABELS.participation} options={PARTICIPATION} value={form.participation} onChange={(v) => set({ participation: v })} invalid={Boolean(errors.participation)} />
              <FieldError id="tb-participation-err">{errors.participation}</FieldError>
            </div>
            {team && (
              <>
                <Field id="tb-teamSize" label={LABELS.teamSize} error={errors.teamSize}>
                  <select id="tb-teamSize" value={form.teamSize} onChange={(e) => set({ teamSize: e.target.value })} aria-invalid={Boolean(errors.teamSize)} aria-describedby="tb-teamSize-err" aria-required="true" className={fieldInput}>
                    <option value="">Select team size</option>
                    {TEAM_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                {norm.teamSize >= TEAM_SIZES[0] && <Roster form={form} norm={norm} errors={errors} setMember={setMember} />}
              </>
            )}
          </SectionCard>

          <SectionCard index={2} section={SECTIONS[2]} reduce={reduce}>
            <TextField k="ideaTitle" value={form.ideaTitle} errors={errors} set={set} maxLength={LIMITS.ideaTitle} />
            <Field id="tb-domain" label={LABELS.domain} error={errors.domain}>
              <select id="tb-domain" value={form.domain} onChange={(e) => set({ domain: e.target.value })} aria-invalid={Boolean(errors.domain)} aria-describedby="tb-domain-err" aria-required="true" className={fieldInput}>
                <option value="">{PLACEHOLDERS.domain}</option>
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field id="tb-city" label={LABELS.city} hint={COPY.cityNote} error={errors.city}>
              <select id="tb-city" value={form.city} onChange={(e) => set({ city: e.target.value })} aria-invalid={Boolean(errors.city)} aria-describedby="tb-city-err" aria-required="true" className={fieldInput}>
                <option value="">{PLACEHOLDERS.city}</option>
                {Object.entries(ZONES).map(([zone, cities]) => (
                  <optgroup key={zone} label={`${zone} Zone`}>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
          </SectionCard>

          <SectionCard index={3} section={SECTIONS[3]} reduce={reduce}>
            <PdfDropZone
              id="tb-idCards" label={LABELS.idCards} help={PLACEHOLDERS.idCardsHelp} prompt={PLACEHOLDERS.dropzone} sub={PLACEHOLDERS.dropzoneSub}
              file={file} error={errors.idCards} progress={phase === 'uploading' ? progress : null} disabled={busy}
              onPick={(f) => { setFile(f); setServerError('') }}
            />
            <div className="mt-3">
              <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-black/15 bg-white px-3.5 py-3 text-sm text-ink focus-within:ring-4 focus-within:ring-orange/30">
                <input id="tb-consent" type="checkbox" checked={form.consent} onChange={(e) => set({ consent: e.target.checked })} aria-invalid={Boolean(errors.consent)} aria-describedby="tb-consent-err" aria-required="true" className="mt-0.5 h-5 w-5 shrink-0 accent-orange" />
                <span>{COPY.consent}</span>
              </label>
              <FieldError id="tb-consent-err">{errors.consent}</FieldError>
            </div>
            <p className="mt-1 text-xs text-black/55">{COPY.storageNote}</p>

            <div role="alert" className="mt-3 min-h-[1.5rem] text-sm font-medium text-red-600">{serverError}</div>
            <button type="submit" disabled={busy} className={`${primaryButton} mt-2 w-full sm:w-auto`}>
              {phase === 'uploading' ? `Uploading… ${progress ?? 0}%` : phase === 'saving' ? 'Saving your registration…' : COPY.submit}
              {!busy && <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>}
            </button>
          </SectionCard>

          <p className="px-1 text-center text-xs text-black/55">
            {COPY.contactLine} <a href={`mailto:${COPY.contactEmail}`} className={`font-semibold underline underline-offset-2 ${ORANGE_ON_LIGHT}`}>{COPY.contactEmail}</a>
          </p>
        </form>
      </div>
    </RegisterShell>
  )
}
