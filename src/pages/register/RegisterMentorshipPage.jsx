import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import RegisterShell, { fieldLabel, primaryButton, FieldError } from '../../components/register/RegisterShell.jsx'
import ApplicantFields from '../../components/register/ApplicantFields.jsx'
import DonePanel from '../../components/register/DonePanel.jsx'
import {
  REGISTRATION_OPTIONS,
  MENTORSHIP_SLOTS,
  mentorshipDates,
  formatMentorshipSuccess,
} from '../../data/registrationOptions.js'
import { applicantErrors, applicantPayload, submitMentorship } from '../../lib/registration.js'
import { useApplicant } from '../../lib/useApplicant.js'

const OPTION = REGISTRATION_OPTIONS.mentorship

// Radio-style choice button used for both the date chips and the slots.
function Choice({ selected, onSelect, className = '', children, label }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={`rounded-2xl border text-center outline-none transition-colors focus-visible:ring-4 focus-visible:ring-orange/30 ${
        selected ? 'border-orange bg-orange text-white shadow-[0_10px_30px_-12px_rgba(249,115,22,0.6)]' : 'border-black/15 bg-white text-ink hover:border-black/35'
      } ${className}`}
    >
      {children}
    </button>
  )
}

// One-on-One Mentorship: open to everyone (students of any campus and non-students), so the applicant block is the
// full version. One form: applicant fields + date + slot, one request.
export default function RegisterMentorshipPage() {
  const honeypot = useRef(null)
  const [applicant, patch] = useApplicant()
  const [dates] = useState(() => mentorshipDates()) // next 28 days from tomorrow (IST), Sundays removed
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('idle') // idle | sending | done
  const [serverError, setServerError] = useState('')
  const [doneMessage, setDoneMessage] = useState('')

  const dropErrors = (...keys) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))))
  const changeApplicant = (changes) => {
    patch(changes)
    dropErrors(...Object.keys(changes))
    setServerError('')
  }
  const pickDate = (iso) => {
    setDate(iso)
    dropErrors('date')
    setServerError('')
  }
  const pickSlot = (id) => {
    setSlot(id)
    dropErrors('slot')
    setServerError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (phase !== 'idle') return
    const found = { ...applicantErrors(applicant) }
    if (!date) found.date = 'Pick a date.'
    if (!slot) found.slot = 'Pick a slot.'
    setErrors(found)
    setServerError('')
    if (Object.keys(found).length) return

    setPhase('sending')
    const result = await submitMentorship(applicantPayload(applicant), { date, slot }, honeypot.current?.value || '')
    if (result.status === 'ok') {
      setDoneMessage(formatMentorshipSuccess(date, slot))
      setPhase('done')
      return
    }
    // 'already' = this exact email + date + slot is booked: the student can still pick another date or slot.
    setServerError(result.message || 'Something went wrong. Please try again.')
    setPhase('idle')
  }

  const another = () => {
    setDate('')
    setSlot('')
    setErrors({})
    setServerError('')
    setPhase('idle')
  }

  if (phase === 'done') {
    return (
      <DonePanel step={OPTION.title} title="Request received" message={doneMessage}>
        <button type="button" onClick={another} className={primaryButton}>Book another session</button>
      </DonePanel>
    )
  }

  const sending = phase === 'sending'
  // Month labels between chips so a 4-week window stays easy to scan.
  const monthStarts = new Set(dates.filter((d, i) => i === 0 || d.monthShort !== dates[i - 1].monthShort).map((d) => d.iso))

  return (
    <RegisterShell wide step={OPTION.title} title="Book a mentor session" intro={OPTION.description}>
      <form noValidate onSubmit={submit} className="mx-auto max-w-2xl rounded-3xl border border-black/10 bg-white/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9">
        {/* honeypot: off-screen, not focusable, ignored by assistive tech */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </div>

        <ApplicantFields value={applicant} onChange={changeApplicant} errors={errors} />

        <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Your session</p>
        <p id="mentor-date-label" className={`${fieldLabel} mt-3`}>Preferred date <span className="font-normal normal-case tracking-normal text-black/45">(IST, Sundays unavailable)</span></p>
        <div role="radiogroup" aria-labelledby="mentor-date-label" aria-describedby="mentor-date-err" className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
          {dates.map((d) => (
            <div key={d.iso} className="contents">
              {monthStarts.has(d.iso) && (
                <p className="col-span-full mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">
                  {d.monthShort}
                </p>
              )}
              <Choice selected={date === d.iso} onSelect={() => pickDate(d.iso)} label={`${d.day} ${d.dayOfMonth} ${d.monthShort}`} className="min-h-[64px] px-2 py-2">
                <span className={`block text-[11px] font-semibold uppercase tracking-wide ${date === d.iso ? 'text-white/85' : 'text-black/50'}`}>{d.dayShort}</span>
                <span className="block font-display text-xl font-bold leading-tight">{d.dayOfMonth}</span>
              </Choice>
            </div>
          ))}
        </div>
        <FieldError id="mentor-date-err">{errors.date}</FieldError>

        <p id="mentor-slot-label" className={`${fieldLabel} mt-3`}>Slot</p>
        <div role="radiogroup" aria-labelledby="mentor-slot-label" aria-describedby="mentor-slot-err" className="mt-2 grid gap-3 sm:grid-cols-2">
          {MENTORSHIP_SLOTS.map((s) => (
            <Choice key={s.id} selected={slot === s.id} onSelect={() => pickSlot(s.id)} label={s.label} className="min-h-[56px] px-4 py-3 text-sm font-semibold">
              {s.label}
            </Choice>
          ))}
        </div>
        <FieldError id="mentor-slot-err">{errors.slot}</FieldError>

        {/* server errors (e.g. this exact date and slot is already booked): nothing is confirmed unless it was saved */}
        <div role="alert" className="mt-1 min-h-[1.5rem] text-sm font-medium text-red-600">{serverError}</div>

        <div className="mt-2 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/register" className="text-center text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline">← Back to options</Link>
          <button type="submit" disabled={sending} className={primaryButton}>
            {sending ? 'Booking…' : 'Request session'}
            {!sending && <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>}
          </button>
        </div>
      </form>
    </RegisterShell>
  )
}
