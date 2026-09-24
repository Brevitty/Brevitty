import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { destinationAfterLogin } from '../lib/hubAccess.js'

const ease = [0.22, 1, 0.36, 1]
const SHAKE_X = [0, -10, 10, -6, 6, 0]
const DESKTOP_FINE_POINTER = '(min-width: 1024px) and (pointer: fine)'
// #c2410c keeps small orange text above AA contrast on light backgrounds.
const ORANGE_ON_LIGHT = 'text-[#c2410c]'

const fieldLabel =
  'block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/60'
const fieldInput =
  'mt-1.5 block min-h-[48px] w-full rounded-xl border border-black/20 bg-white px-3.5 py-3 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-black/30 focus:border-orange focus:ring-4 focus:ring-orange/20 sm:text-sm'

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

export default function SignInPage() {
  const reduce = useReducedMotion()
  const { status, memberships, refresh } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef(null)
  const shake = useAnimationControls()

  useEffect(() => {
    if (window.matchMedia(DESKTOP_FINE_POINTER).matches) {
      emailRef.current?.focus({ preventScroll: true })
    }
  }, [])

  // Already signed in (or just became signed in): run the redirect logic.
  if (status === 'signedIn') {
    return <Navigate to={destinationAfterLogin(next, memberships)} replace />
  }

  const fail = (msg) => {
    setError(msg)
    if (!reduce) shake.start({ x: SHAKE_X, transition: { duration: 0.5, ease } })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        // Only trim — email matching is exact and case-sensitive.
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return fail(data.error || 'Something went wrong. Please try again.')
      // Cookie is set; load the account. The status flip renders <Navigate/> above.
      const account = await refresh()
      if (account.status !== 'signedIn') {
        fail('Signed in, but we could not load your account. Please try again.')
      }
    } catch {
      fail('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 pb-16 pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_30%,rgba(249,115,22,0.10),transparent_70%)]" />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className="relative z-10 w-full max-w-md"
      >
        <motion.form
          animate={shake}
          onSubmit={submit}
          className="rounded-3xl border border-black/10 bg-white p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] sm:p-9"
        >
          <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${ORANGE_ON_LIGHT}`}>
            Brevitty Hub
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink">Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            One sign-in for every Hub workspace. Your access details come from the Brevitty team by email.
          </p>

          <label htmlFor="hub-email" className={`mt-7 ${fieldLabel}`}>Email</label>
          <input
            ref={emailRef}
            id="hub-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            autoComplete="username"
            placeholder="you@email.com"
            className={fieldInput}
          />

          <label htmlFor="hub-password" className={`mt-4 ${fieldLabel}`}>Password</label>
          <div className="relative">
            <input
              id="hub-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`${fieldInput} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-0 top-1.5 flex h-[48px] w-11 items-center justify-center rounded-xl text-black/55 outline-none transition-colors hover:text-ink focus-visible:ring-4 focus-visible:ring-orange/25"
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>

          {/* always mounted with reserved height so an error never shifts the layout */}
          <div role="alert" className="mt-3 min-h-[1.5rem] text-sm font-medium text-red-600">
            {error}
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={reduce || loading ? undefined : { scale: 1.02, y: -1 }}
            whileTap={reduce || loading ? undefined : { scale: 0.98 }}
            className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-orange px-6 py-3.5 text-sm font-bold text-ink shadow-[0_14px_34px_-12px_rgba(249,115,22,0.7)] outline-none transition-opacity focus-visible:ring-4 focus-visible:ring-orange/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-ink/25 border-t-ink" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <span aria-hidden="true">→</span>
              </>
            )}
          </motion.button>
        </motion.form>
      </motion.div>
    </section>
  )
}
