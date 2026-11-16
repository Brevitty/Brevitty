// Startup Junction and Startup Arena are for students of the four campuses, so the first screen is just a campus
// picker: tapping a campus is the eligibility check and goes straight to the form (`children(campus)`) with that
// campus preselected. "Not from these campuses?" opens a friendly card pointing at the options open to everyone.
// No API call happens here; the server enforces the same rule independently.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import RegisterShell, { primaryButton } from './RegisterShell.jsx'
import {
  REGISTRATION_OPTIONS,
  OPEN_OPTIONS,
  OPTION_ROUTES,
  VERIFIED_CAMPUSES,
  CAMPUS_PROMPT,
  NOT_FROM_CAMPUSES,
  notEligibleMessage,
} from '../../data/registrationOptions.js'

const CARD = 'rounded-3xl border border-black/10 bg-white/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9'
const TEXT_LINK = 'text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline'

export default function EligibilityGate({ option, children }) {
  const title = REGISTRATION_OPTIONS[option].title
  const [campus, setCampus] = useState('')
  const [notFromCampuses, setNotFromCampuses] = useState(false)

  if (VERIFIED_CAMPUSES.includes(campus)) return children(campus)

  if (notFromCampuses) {
    return (
      <RegisterShell title="Not open to you yet">
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
            <Link to="/register" className={TEXT_LINK}>← Back to options</Link>
            <button type="button" onClick={() => setNotFromCampuses(false)} className={TEXT_LINK}>Choose a campus</button>
          </div>
        </div>
      </RegisterShell>
    )
  }

  return (
    <RegisterShell title={title}>
      <div className={CARD}>
        <p id="campus-prompt" className="font-display text-xl font-bold tracking-tight text-ink">{CAMPUS_PROMPT}</p>
        <div role="group" aria-labelledby="campus-prompt" className="mt-4 grid grid-cols-2 gap-3">
          {VERIFIED_CAMPUSES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCampus(c)}
              className="flex min-h-[88px] items-center justify-center rounded-2xl border border-black/15 bg-white px-3 text-center text-base font-semibold leading-snug text-ink outline-none transition-all hover:-translate-y-0.5 hover:border-orange hover:shadow-[0_14px_34px_-18px_rgba(249,115,22,0.6)] focus-visible:border-orange focus-visible:ring-4 focus-visible:ring-orange/30 active:scale-[0.98]"
            >
              {c}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setNotFromCampuses(true)} className={`${TEXT_LINK} mt-5 block`}>{NOT_FROM_CAMPUSES}</button>
        <Link to="/register" className={`${TEXT_LINK} mt-3 block`}>← Back to options</Link>
      </div>
    </RegisterShell>
  )
}
