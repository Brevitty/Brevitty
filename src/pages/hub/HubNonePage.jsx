import { Link } from 'react-router-dom'
import HubShell, { HUB_TEAM_EMAIL, primaryPill, secondaryPill } from './HubShell.jsx'

export default function HubNonePage() {
  return (
    <HubShell eyebrow="Brevitty Hub" title="No workspace yet.">
      <p className="max-w-xl text-base leading-relaxed text-black/60">
        Your account is set up, but it isn’t linked to a workspace. Contact the Hub team and we’ll sort it out.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`mailto:${HUB_TEAM_EMAIL}`} className={primaryPill}>
          Contact the Hub team
        </a>
        <Link to="/" className={secondaryPill}>
          Back to home
        </Link>
      </div>
    </HubShell>
  )
}
