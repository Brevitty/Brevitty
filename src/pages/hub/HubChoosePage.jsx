import { Link, Navigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPillar, pillarHref } from '../../data/hubPillars.js'
import { approvedOf, landingPath } from '../../lib/hubAccess.js'
import HubShell from './HubShell.jsx'

const ease = [0.22, 1, 0.36, 1]

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.5, ease, delay: 0.05 + i * 0.05 } }),
}

// Cards wrap in a centered flex row: 1 per row on phones, 2 on tablets, 3 on desktop, and a
// short last row (the 7th card, or the 5th on tablet) sits in the middle instead of hugging the left.
// Width = (100% - gaps) / columns, with a 1.25rem gap.
const CARD_WIDTH = 'w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc((100%-2.5rem)/3)]'
const cardBase = 'flex min-h-[180px] flex-col justify-between rounded-2xl border bg-white p-6'

function CardBody({ pillar, index, role }) {
  return (
    <>
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-sm font-semibold text-black/30 transition-colors group-hover:text-orange">
            [{String(index + 1).padStart(2, '0')}]
          </span>
          {pillar.comingSoon && (
            <span className="rounded-full border border-black/15 bg-black/[0.04] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-black/60">
              Coming soon
            </span>
          )}
        </div>
        <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-ink">
          {pillar.title}
          {role === 'admin' && ' · Admin'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-black/55">{pillar.description}</p>
      </div>
      {!pillar.comingSoon && (
        <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#c2410c]">
          Enter workspace
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      )}
    </>
  )
}

// My workspace: every workspace this account is approved for, one card each. Sign-in lands
// here when there are several; a single-workspace account goes straight in (landingPath()),
// but can still open this page from the account menu. Workspaces without a page yet show a
// "Coming soon" badge and don't open.
export default function HubChoosePage() {
  const reduce = useReducedMotion()
  const { user, memberships } = useAuth()
  const approved = approvedOf(memberships)
  const pending = memberships.filter((m) => m.status === 'pending')

  if (!approved.length) return <Navigate to={landingPath(memberships)} replace />

  const firstName = (user?.name || user?.email || '').trim().split(/\s+/)[0]
  const cards = approved.map((m) => ({ m, pillar: getPillar(m.pillar) })).filter((c) => c.pillar)

  return (
    <HubShell eyebrow="My workspace" title={`Welcome back, ${firstName}.`} wide>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="max-w-xl text-base leading-relaxed text-black/60"
      >
        {cards.length === 1
          ? 'Your account has access to one workspace.'
          : `Your account has access to ${cards.length} workspaces. Pick one to continue.`}
      </motion.p>

      <div data-testid="workspace-cards" className="mt-10 flex flex-wrap justify-center gap-5">
        {cards.map(({ m, pillar }, i) => {
          const href = pillarHref(pillar)
          return (
            <motion.div
              key={m.pillar}
              custom={i}
              initial={reduce ? false : 'hidden'}
              animate="show"
              variants={cardVariants}
              className={CARD_WIDTH}
            >
              {href ? (
                <Link
                  to={href}
                  className={`group ${cardBase} h-full border-black/10 transition-colors duration-300 hover:border-orange/60 hover:shadow-[0_28px_56px_-26px_rgba(249,115,22,0.35)]`}
                >
                  <CardBody pillar={pillar} index={i} role={m.role} />
                </Link>
              ) : (
                <div aria-disabled="true" className={`${cardBase} h-full border-dashed border-black/15 bg-[#fafaf8]`}>
                  <CardBody pillar={pillar} index={i} role={m.role} />
                </div>
              )}
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
