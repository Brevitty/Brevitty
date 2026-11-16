// Startup Junction and Startup Arena are for students of the four campuses. This asks FIRST, before any other
// field is shown, and only renders `children(campus)` (the real form) for an eligible student. Anyone else gets a
// friendly "not eligible" card pointing at the options that are open to everyone. No API call happens here.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import RegisterShell, { fieldLabel, fieldInput, primaryButton } from './RegisterShell.jsx'
import { YesNo } from './ApplicantFields.jsx'
import {
  REGISTRATION_OPTIONS,
  OPEN_OPTIONS,
  OPTION_ROUTES,
  ELIGIBILITY_QUESTION,
  VERIFIED_CAMPUSES,
  notEligibleMessage,
} from '../../data/registrationOptions.js'

const CARD = 'rounded-3xl border border-black/10 bg-white/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9'

export default function EligibilityGate({ option, children }) {
  const title = REGISTRATION_OPTIONS[option].title
  const [answer, setAnswer] = useState('') // '' | 'Yes' | 'No'
  const [campus, setCampus] = useState('')

  if (answer === 'Yes' && VERIFIED_CAMPUSES.includes(campus)) return children(campus)

  return (
    <RegisterShell step={title} title={answer === 'No' ? 'Not open to you yet' : 'Before you register'} intro={answer ? undefined : `${title} is for students of our partner campuses.`}>
      {answer === 'No' ? (
        <div role="status" className={CARD}>
          <p className="text-base font-medium text-ink">{notEligibleMessage(title)}</p>
          <p className="mt-2 text-sm text-black/60">You can still join one of these:</p>
          <div className="mt-4 flex flex-col gap-3">
            {OPEN_OPTIONS.map((id) => (
              <Link key={id} to={OPTION_ROUTES[id]} className={primaryButton}>
                {REGISTRATION_OPTIONS[id].title}
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <Link to="/register" className="text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline">← Back to options</Link>
            <button type="button" onClick={() => setAnswer('')} className="text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline">
              I answered by mistake
            </button>
          </div>
        </div>
      ) : (
        <div className={CARD}>
          <p className="text-base font-semibold leading-snug text-ink">{ELIGIBILITY_QUESTION}</p>
          <YesNo label={ELIGIBILITY_QUESTION} value={answer} onChange={(v) => { setAnswer(v); setCampus('') }} />

          {answer === 'Yes' && (
            <div className="mt-4">
              <label htmlFor="gate-campus" className={fieldLabel}>Which campus?</label>
              <select id="gate-campus" value={campus} onChange={(e) => setCampus(e.target.value)} className={fieldInput}>
                <option value="">Select your campus</option>
                {VERIFIED_CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="mt-6">
            <Link to="/register" className="text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline">← Back to options</Link>
          </div>
        </div>
      )}
    </RegisterShell>
  )
}
