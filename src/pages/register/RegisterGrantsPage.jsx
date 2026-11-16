import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import RegisterShell, { primaryButton } from '../../components/register/RegisterShell.jsx'
import ApplicantFields from '../../components/register/ApplicantFields.jsx'
import DonePanel from '../../components/register/DonePanel.jsx'
import { REGISTRATION_OPTIONS } from '../../data/registrationOptions.js'
import { applicantErrors, applicantPayload, submitRegistration } from '../../lib/registration.js'
import { useApplicant } from '../../lib/useApplicant.js'

const OPTION = REGISTRATION_OPTIONS.grants

// Competitions and Grants: open to everyone, so it is just the shared applicant fields.
export default function RegisterGrantsPage() {
  const honeypot = useRef(null)
  const [applicant, patch] = useApplicant()
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('idle') // idle | sending | done
  const [serverError, setServerError] = useState('')
  const [doneMessage, setDoneMessage] = useState('')

  const change = (changes) => {
    patch(changes)
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in changes))))
    setServerError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (phase !== 'idle') return
    const found = applicantErrors(applicant)
    setErrors(found)
    setServerError('')
    if (Object.keys(found).length) return

    setPhase('sending')
    const result = await submitRegistration('grants', applicantPayload(applicant), honeypot.current?.value || '')
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
    <RegisterShell step={OPTION.title} title="Competitions and Grants" intro={OPTION.description}>
      <form noValidate onSubmit={submit} className="rounded-3xl border border-black/10 bg-white/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9">
        {/* honeypot: off-screen, not focusable, ignored by assistive tech */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </div>

        <ApplicantFields value={applicant} onChange={change} errors={errors} />

        {/* server errors: nothing is confirmed unless the registration was actually saved */}
        <div role="alert" className="mt-1 min-h-[1.5rem] text-sm font-medium text-red-600">{serverError}</div>

        <div className="mt-2 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/register" className="text-center text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline">← Back to options</Link>
          <button type="submit" disabled={sending} className={primaryButton}>
            {sending ? 'Registering…' : 'Register'}
            {!sending && <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>}
          </button>
        </div>
      </form>
    </RegisterShell>
  )
}
