import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import RegisterShell, { primaryButton } from '../../components/register/RegisterShell.jsx'
import { REGISTRATION_OPTIONS, STUDENT_OPTIONS, OPEN_OPTIONS } from '../../data/registrationOptions.js'
import {
  loadRegistration,
  loadDone,
  markDone,
  clearRegistration,
  submitRegistration,
  hasStep1,
  isVerifiedPath,
  hasStep2,
  nextRoute,
} from '../../lib/registration.js'

const ease = [0.22, 1, 0.36, 1]

function OptionCard({ id, index, state, onRegister }) {
  const reduce = useReducedMotion()
  const opt = REGISTRATION_OPTIONS[id]
  const { status, message } = state // 'idle' | 'loading' | 'ok' | 'already' | 'error'
  const finished = status === 'ok' || status === 'already'

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: index * 0.06 }}
      className="flex flex-col rounded-2xl border border-black/10 bg-white p-6 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.25)]"
    >
      <h2 className="font-display text-xl font-bold tracking-tight text-ink">{opt.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-black/60">{opt.description}</p>

      <button
        type="button"
        disabled={status === 'loading' || finished}
        onClick={() => onRegister(id)}
        className={`${primaryButton} mt-5 w-full`}
      >
        {status === 'loading' ? 'Registering…' : finished ? 'Registered ✓' : 'Register'}
        {status === 'idle' || status === 'error' ? (
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        ) : null}
      </button>

      {/* reserved height so a confirmation or error never shifts the grid */}
      <p
        role={status === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        className={`mt-3 min-h-[2.5rem] text-sm font-medium ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}
      >
        {status === 'ok' && opt.success}
        {status === 'already' && (message || "You're already registered for this one.")}
        {status === 'error' && message}
      </p>
    </motion.li>
  )
}

// variant: 'student' (verified campus path: 4 cards) | 'open' (everyone else: 2 cards)
export default function RegisterOptionsPage({ variant }) {
  const navigate = useNavigate()
  const data = loadRegistration()
  const honeypot = useRef(null) // hidden field a human never fills; bots do
  const [states, setStates] = useState(() =>
    Object.fromEntries(Object.keys(loadDone()).map((id) => [id, { status: 'ok' }]))
  )

  // Route guards: no step data -> /register; wrong path for this visitor -> where they belong.
  if (!hasStep1(data)) return <Navigate to="/register" replace />
  const verified = isVerifiedPath(data)
  if (variant === 'student' && !verified) return <Navigate to="/register" replace />
  if (variant === 'student' && !hasStep2(data)) return <Navigate to="/register/details" replace />
  if (variant === 'open' && nextRoute(data) !== '/register/open') return <Navigate to={nextRoute(data)} replace />

  const ids = variant === 'student' ? STUDENT_OPTIONS : OPEN_OPTIONS
  const setOne = (id, patch) => setStates((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  const register = async (id) => {
    setOne(id, { status: 'loading', message: '' })
    const result = await submitRegistration(id, data, honeypot.current?.value || '')
    if (result.status === 'ok' || result.status === 'already') markDone(id)
    setOne(id, result)
  }

  const startOver = () => {
    clearRegistration()
    navigate('/register')
  }

  return (
    <RegisterShell
      wide
      step={variant === 'student' ? 'Step 3' : 'Step 2'}
      title={`Welcome, ${data.name.split(' ')[0]}`}
      intro="Choose what you'd like to join. You can register for more than one."
    >
      {/* honeypot: off-screen, not focusable, ignored by assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <ul className={`mx-auto grid gap-5 ${variant === 'student' ? 'sm:grid-cols-2' : 'max-w-3xl sm:grid-cols-2'}`}>
        {ids.map((id, i) => (
          <OptionCard key={id} id={id} index={i} state={states[id] || { status: 'idle' }} onRegister={register} />
        ))}
      </ul>

      <p className="mt-8 text-center text-sm text-black/55">
        Not you?{' '}
        <button type="button" onClick={startOver} className="font-semibold text-ink underline-offset-4 hover:underline">
          Start over
        </button>
        {' · '}
        <Link to="/" className="font-semibold text-ink underline-offset-4 hover:underline">Back to home</Link>
      </p>
    </RegisterShell>
  )
}
