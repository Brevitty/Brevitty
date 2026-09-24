import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { TOOLS } from '../../data/junctionTools.js'

const ease = [0.22, 1, 0.36, 1]
const DESKTOP_FINE_POINTER = '(min-width: 1024px) and (pointer: fine)'
const SHAKE_X = [0, -10, 10, -6, 6, 0]
const TRAIN_LOOP_S = 5.5

// Small orange on light backgrounds fails AA (2.8:1); #c2410c is 5.2:1 on #fafaf8.
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

/* ---------------- Left panel: the route ---------------- */
function RouteMap({ reduce }) {
  return (
    <ol className="relative mt-12 hidden lg:block">
      {/* rail: faint base + orange line that draws in + a slow "train" dot */}
      <div className="absolute bottom-2 left-[5px] top-2 w-px">
        <div className="absolute inset-0 bg-white/15" />
        <motion.div
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.6, ease, delay: 0.5 }}
          className="absolute inset-0 origin-top bg-orange"
        />
        {!reduce && (
          <motion.span
            aria-hidden="true"
            animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: TRAIN_LOOP_S, ease: 'linear', repeat: Infinity, delay: 2.2 }}
            className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-orange-soft shadow-[0_0_14px_3px_rgba(251,146,60,0.7)]"
          />
        )}
      </div>

      {TOOLS.map((t, i) => (
        <motion.li
          key={t.id}
          initial={reduce ? false : { opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.6 + i * 0.12 }}
          className="relative flex items-baseline gap-4 pb-[1.15rem] pl-9"
        >
          <span className="absolute left-0 top-[0.55rem] h-[11px] w-[11px] rounded-full border-2 border-white/60 bg-[#08070a]" />
          <span className="w-6 shrink-0 font-mono text-[11px] font-medium text-orange-soft">{t.num}</span>
          <span className="font-display text-lg font-medium leading-tight text-white/90">{t.name}</span>
          {i === 0 && (
            <span className="font-hand text-xl leading-none text-orange-soft [transform:rotate(-4deg)]">
              start here
            </span>
          )}
        </motion.li>
      ))}

      <motion.li
        initial={reduce ? false : { opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease, delay: 0.6 + TOOLS.length * 0.12 }}
        className="relative flex items-center pl-9"
      >
        <span className="absolute left-0 top-1/2 h-[11px] w-[11px] -translate-y-1/2 rounded-full bg-orange shadow-[0_0_0_4px_rgba(249,115,22,0.25)]" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-soft">
          Terminus — investor-ready
        </span>
      </motion.li>
    </ol>
  )
}

// Mobile: the same route collapsed to six dots on a line.
function MiniRoute({ reduce }) {
  return (
    <ol className="relative mt-6 flex justify-between lg:hidden" aria-label="Six advisor stops">
      <motion.div
        aria-hidden="true"
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, ease, delay: 0.4 }}
        className="absolute inset-x-1.5 top-[5px] h-px origin-left bg-orange"
      />
      {TOOLS.map((t) => (
        <li key={t.id} className="relative flex flex-col items-center gap-1.5">
          <span className="h-[11px] w-[11px] rounded-full border-2 border-white/70 bg-[#08070a]" />
          <span className="font-mono text-[10px] text-white/60">{t.num}</span>
        </li>
      ))}
    </ol>
  )
}

/* ---------------- Gate ---------------- */
// `notice` is an optional neutral message (e.g. "session expired") shown above the form fields.
export default function JunctionAuthGate({ onAuthed, notice = '' }) {
  const reduce = useReducedMotion()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef(null)
  const shake = useAnimationControls()

  // Autofocus on desktop only: on phones it pops the keyboard and hides the page.
  useEffect(() => {
    if (window.matchMedia(DESKTOP_FINE_POINTER).matches) {
      emailRef.current?.focus({ preventScroll: true })
    }
  }, [])

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
      if (res.ok) {
        onAuthed(data.email)
        return
      }
      fail(data.error || 'Something went wrong. Please try again.')
    } catch {
      fail('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative grid min-h-screen grid-cols-1 overflow-hidden pt-16 lg:grid-cols-[1.08fr_1fr]">
      {/* ---------- Left / top: event identity + route ---------- */}
      <aside className="relative overflow-hidden bg-[#08070a] px-6 py-9 text-white lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-16">
        <div className="noise-bg pointer-events-none absolute inset-0 opacity-[0.05]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_0%_100%,rgba(249,115,22,0.22),transparent_70%)]" />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="relative z-10 max-w-xl"
        >
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-orange-soft">
            Startup Junction 2026 · Platform 01
          </p>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:mt-6 lg:text-7xl">
            Check in.
            <br />
            <span className="text-orange">Start building.</span>
          </h2>
          <p className="mt-5 hidden max-w-sm text-base leading-relaxed text-white/60 lg:block">
            Six advisors on one route, from a blank page to a fundable startup.
          </p>

          <RouteMap reduce={reduce} />
          <MiniRoute reduce={reduce} />
        </motion.div>
      </aside>

      {/* ---------- Right / bottom: the tear-off stub ---------- */}
      <div className="relative bg-[#fafaf8]">
        {/* perforation: dashed tear line + two notches (vertical on desktop, horizontal on mobile) */}
        <div aria-hidden="true" className="pointer-events-none">
          <div className="absolute inset-x-6 top-0 border-t-2 border-dashed border-black/20 lg:hidden" />
          <span className="absolute -left-[14px] -top-[14px] h-7 w-7 rounded-full bg-[#08070a] lg:hidden" />
          <span className="absolute -right-[14px] -top-[14px] h-7 w-7 rounded-full bg-[#08070a] lg:hidden" />

          <div className="absolute inset-y-8 left-0 hidden border-l-2 border-dashed border-black/20 lg:block" />
          <span className="absolute -left-[14px] top-[10%] hidden h-7 w-7 rounded-full bg-[#08070a] lg:block" />
          <span className="absolute -left-[14px] bottom-[10%] hidden h-7 w-7 rounded-full bg-[#08070a] lg:block" />
        </div>

        <div className="mx-auto flex h-full max-w-md flex-col justify-center px-6 py-10 lg:px-12 lg:py-16">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.25 }}
          >
            <motion.form animate={shake} onSubmit={submit}>
              <div className="flex items-center justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.2em]">
                <span className={ORANGE_ON_LIGHT}>Boarding pass</span>
              </div>

              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-ink">
                Sign in
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-black/60">
                For registered Startup Junction students. Your access details
                come from the Startup Junction team by email.
              </p>

              {notice && !error && (
                <p className={`mt-4 text-sm font-medium ${ORANGE_ON_LIGHT}`}>{notice}</p>
              )}

              <label htmlFor="sj-email" className={`mt-7 ${fieldLabel}`}>
                Email
              </label>
              <input
                ref={emailRef}
                id="sj-email"
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

              <label htmlFor="sj-password" className={`mt-4 ${fieldLabel}`}>
                Password
              </label>
              <div className="relative">
                <input
                  id="sj-password"
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

              {/* always mounted + reserved height, so an error never shifts the layout */}
              <div role="alert" className="mt-3 min-h-[1.5rem] text-sm font-medium text-red-600">
                {error}
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={reduce || loading ? undefined : { scale: 1.02, y: -1 }}
                whileTap={reduce || loading ? undefined : { scale: 0.98 }}
                className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-orange px-6 py-3.5 text-sm font-bold text-ink shadow-[0_14px_34px_-12px_rgba(249,115,22,0.7)] outline-none transition-opacity focus-visible:ring-4 focus-visible:ring-orange/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf8] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-ink/25 border-t-ink"
                    />
                    Checking in…
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
        </div>
      </div>
    </section>
  )
}
