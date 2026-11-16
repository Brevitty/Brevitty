import { motion, useReducedMotion } from 'framer-motion'
import HeroBackground from '../HeroBackground.jsx'
import { STUDENT_EMAIL_HINT, STUDENT_EMAIL_WARNING, isKnownStudentEmail } from '../../data/registrationOptions.js'
import { isEmail } from '../../lib/registration.js'

const ease = [0.22, 1, 0.36, 1]

// Same field/label/button styling as the Hub sign-in and the Hero, so /register looks native.
export const fieldLabel = 'block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/60'
export const fieldInput =
  'mt-1.5 block min-h-[48px] w-full rounded-xl border border-black/20 bg-white px-3.5 py-3 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-black/30 focus:border-orange focus:ring-4 focus:ring-orange/20 sm:text-sm aria-[invalid=true]:border-red-500'
export const primaryButton =
  'group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-orange px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(249,115,22,0.6)] outline-none transition-shadow hover:shadow-[0_14px_40px_-8px_rgba(249,115,22,0.7)] focus-visible:ring-4 focus-visible:ring-orange/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none'
export const ORANGE_ON_LIGHT = 'text-[#c2410c]' // keeps small orange text above AA contrast

export function FieldError({ id, children }) {
  // Always mounted with reserved height so an error never shifts the layout.
  return (
    <p id={id} role="alert" className="mt-1 min-h-[1.25rem] text-xs font-medium text-red-600">
      {children}
    </p>
  )
}

// Helper line under a student-email field. The unknown-domain note is advice only: it never blocks submit.
export function StudentEmailNote({ id, value }) {
  const warn = isEmail(value) && !isKnownStudentEmail(value)
  return (
    <>
      <p id={id} className="mt-1 text-xs text-black/50">{STUDENT_EMAIL_HINT}</p>
      <p role="status" className="mt-1 min-h-[1rem] text-xs font-medium text-amber-700">{warn ? STUDENT_EMAIL_WARNING : ''}</p>
    </>
  )
}

// Page frame: soft peach gradient, centred, clear of the fixed navbar.
export default function RegisterShell({ step, title, intro, wide = false, children }) {
  const reduce = useReducedMotion()
  return (
    <section className="relative flex min-h-screen items-start justify-center overflow-hidden bg-white px-6 pb-20 pt-28 sm:items-center">
      <HeroBackground />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className={`relative z-10 w-full ${wide ? 'max-w-4xl' : 'max-w-md'}`}
      >
        <div className={wide ? 'mx-auto mb-8 max-w-xl text-center' : 'mb-6'}>
          {step && (
            <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${ORANGE_ON_LIGHT}`}>{step}</p>
          )}
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-ink">{title}</h1>
          {intro && <p className="mt-2 text-sm leading-relaxed text-black/60 sm:text-base">{intro}</p>}
        </div>
        {children}
      </motion.div>
    </section>
  )
}
