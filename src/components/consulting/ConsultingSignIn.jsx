import { useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { login } from '../../lib/consultingApi.js'
import { Button, Spinner, inputClass, labelClass, ORANGE_TEXT } from './ui.jsx'

const ease = [0.22, 1, 0.36, 1]
const SHAKE_X = [0, -10, 10, -6, 6, 0]
const LEDGER_LINES = ['Sessions', 'Minutes of meeting', 'Tasks', 'Deliverables']

// One sign-in for students and sir; the server decides the role.
export default function ConsultingSignIn({ notice, onSignedIn }) {
  const reduce = useReducedMotion()
  const shake = useAnimationControls()
  const emailRef = useRef(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      onSignedIn(await login(email.trim(), password))
    } catch (err) {
      setError(err.message)
      setPassword('')
      if (!reduce) shake.start({ x: SHAKE_X, transition: { duration: 0.4 } })
      emailRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* ---------- identity panel ---------- */}
      <aside className="relative overflow-hidden bg-ink px-6 py-10 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="noise-bg pointer-events-none absolute inset-0 opacity-[0.05]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_100%_0%,rgba(249,115,22,0.22),transparent_70%)]" />
        <span className="relative font-display text-xl font-bold tracking-tight">
          brevitty<span className="text-orange">.</span>
        </span>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="relative mt-10 lg:mt-0"
        >
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-orange">Consulting · Office hours</p>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
            Every session,
            <br />
            <span className="text-orange">on the record.</span>
          </h2>
          <ol className="mt-10 hidden space-y-0 border-t border-white/10 lg:block">
            {LEDGER_LINES.map((line, i) => (
              <motion.li
                key={line}
                initial={reduce ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.3 + i * 0.08 }}
                className="flex items-baseline gap-5 border-b border-white/10 py-3.5"
              >
                <span className="font-mono text-xs font-semibold text-orange">[{String(i + 1).padStart(2, '0')}]</span>
                <span className="font-display text-lg font-semibold text-white/85">{line}</span>
              </motion.li>
            ))}
          </ol>
        </motion.div>

        <p className="relative mt-10 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/35 lg:block">All times Asia/Kolkata</p>
      </aside>

      {/* ---------- form ---------- */}
      <div className="flex items-center justify-center bg-[#fafaf8] px-6 py-12 sm:px-10">
        <motion.form
          animate={shake}
          onSubmit={submit}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease, delay: 0.15 }}
          className="w-full max-w-sm"
          noValidate
        >
          <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.22em] ${ORANGE_TEXT}`}>Sign in</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink">Your workspace</h1>
          <p className="mt-2 text-sm leading-relaxed text-black/55">Use the email and password you received from your consultant.</p>

          {notice && !error && <p className={`mt-4 text-sm font-medium ${ORANGE_TEXT}`}>{notice}</p>}

          <label htmlFor="cn-email" className={`mt-8 block ${labelClass}`}>
            Email
          </label>
          <input
            ref={emailRef}
            id="cn-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            placeholder="you@college.edu"
            className={`mt-1.5 ${inputClass}`}
          />
          <label htmlFor="cn-password" className={`mt-4 block ${labelClass}`}>
            Password
          </label>
          <input
            id="cn-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
            placeholder="••••••••"
            className={`mt-1.5 ${inputClass}`}
          />

          <div role="alert" className="mt-3 min-h-[1.5rem] text-sm font-medium text-red-600">
            {error}
          </div>

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? (
              <>
                <Spinner /> Signing in…
              </>
            ) : (
              <>Sign in →</>
            )}
          </Button>
        </motion.form>
      </div>
    </section>
  )
}
