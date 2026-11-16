import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPillar } from '../../data/hubPillars.js'
import { approvedOf, landingPath } from '../../lib/hubAccess.js'
import HubShell, { HUB_TEAM_EMAIL, primaryPill, secondaryPill } from './HubShell.jsx'

const STATUS_COPY = {
  pending: { label: 'Under review', cls: 'border-[#c2410c]/30 bg-orange/10 text-[#c2410c]' },
  rejected: { label: 'Not approved', cls: 'border-black/15 bg-black/[0.04] text-black/70' },
  approved: { label: 'Approved', cls: 'border-black/15 bg-black/[0.04] text-black/70' },
}

export default function HubStatusPage() {
  const { memberships } = useAuth()
  if (!memberships.length) return <Navigate to="/hub/none" replace />

  const hasPending = memberships.some((m) => m.status === 'pending')
  const hasApproved = approvedOf(memberships).length > 0

  return (
    <HubShell
      eyebrow="Application status"
      title={hasPending ? 'Your application is under review.' : 'Your application was not approved.'}
    >
      <p className="max-w-xl text-base leading-relaxed text-black/60">
        {hasPending
          ? 'We’ll open your workspace as soon as it’s approved. Nothing else is needed from you right now.'
          : 'Your application was not approved. Please contact the Hub team if you think this is a mistake.'}
      </p>

      <ul className="mt-8 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
        {memberships.map((m) => (
          <li key={m.pillar} className="flex items-center justify-between gap-4 px-5 py-4">
            <span className="font-display text-lg font-medium text-ink">
              {getPillar(m.pillar)?.title ?? m.pillar}
            </span>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${STATUS_COPY[m.status].cls}`}
            >
              {STATUS_COPY[m.status].label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        {hasApproved && (
          <Link to={landingPath(memberships)} className={primaryPill}>
            Go to your workspace →
          </Link>
        )}
        <a href={`mailto:${HUB_TEAM_EMAIL}`} className={secondaryPill}>
          Contact the Hub team
        </a>
      </div>
    </HubShell>
  )
}
