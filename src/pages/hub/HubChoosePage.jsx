import { Link, Navigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPillar } from '../../data/hubPillars.js'
import { approvedOf, landingPath } from '../../lib/hubAccess.js'
import HubShell from './HubShell.jsx'

const ease = [0.22, 1, 0.36, 1]

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.5, ease, delay: 0.1 + i * 0.08 } }),
}

// The mandatory post-sign-in landing screen: every signed-in account sees this
// first, listing only the pillar(s) it's actually approved for — one card or
// several, always the same deliberate landing moment. Never skipped, even for
// a single-pillar account (see landingPath() in hubAccess.js).
export default function HubChoosePage() {
  const reduce = useReducedMotion()
  const { user, memberships } = useAuth()
  const approved = approvedOf(memberships)
  const pending = memberships.filter((m) => m.status === 'pending')

  if (!approved.length) return <Navigate to={landingPath(memberships)} replace />

  const firstName = (user?.name || user?.email || '').trim().split(/\s+/)[0]

  return (
    <HubShell eyebrow="Your workspaces" title={`Welcome back, ${firstName}.`}>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="max-w-xl text-base leading-relaxed text-black/60"
      >
        {approved.length === 1
          ? 'Your account has access to one workspace.'
          : `Your account has access to ${approved.length} workspaces. Pick one to continue.`}
      </motion.p>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {approved.map((m, i) => {
          const pillar = getPillar(m.pillar)
          if (!pillar) return null
          return (
            <motion.div
              key={m.pillar}
              custom={i}
              initial={reduce ? false : 'hidden'}
              animate="show"
              variants={cardVariants}
            >
              <Link
                to={`/hub/${pillar.slug}`}
                className="group flex min-h-[180px] flex-col justify-between rounded-2xl border border-black/10 bg-white p-6 transition-colors duration-300 hover:border-orange/60 hover:shadow-[0_28px_56px_-26px_rgba(249,115,22,0.35)]"
              >
                <div>
                  <span className="font-mono text-sm font-semibold text-black/30 transition-colors group-hover:text-orange">
                    [{String(i + 1).padStart(2, '0')}]
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-ink">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-black/55">{pillar.description}</p>
                </div>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#c2410c]">
                  Enter workspace
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </motion.div>
          )
        })}
      </div>

      {pending.length > 0 && (
        <p className="mt-8 text-sm leading-relaxed text-black/60">
          Also under review: {pending.map((m) => getPillar(m.pillar)?.title ?? m.pillar).join(', ')}.
        </p>
      )}
    </HubShell>
  )
}
