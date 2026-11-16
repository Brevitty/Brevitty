import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPillar, getPillarBySlug, pillarHref } from '../../data/hubPillars.js'
import { approvedOf } from '../../lib/hubAccess.js'
import HubShell, { primaryPill, secondaryPill } from './HubShell.jsx'
import JunctionDashboard from '../../components/junction/dashboard/JunctionDashboard.jsx'
import LaunchpadDashboard from '../../components/launchpad/LaunchpadDashboard.jsx'
import IncubationDashboard from '../../components/incubation/IncubationDashboard.jsx'
import VacDashboard from '../../components/vac/VacDashboard.jsx'
import HubAdminDashboard from '../../components/hubadmin/HubAdminDashboard.jsx'

// Workspaces with a real dashboard. Each gets the same props and the same access re-check.
const DASHBOARDS = {
  startup: JunctionDashboard,
  launchpad: LaunchpadDashboard,
  incubation: IncubationDashboard,
  vac: VacDashboard,
  admin: HubAdminDashboard,
}

function NotFound() {
  return (
    <HubShell eyebrow="Brevitty Hub" title="Workspace not found.">
      <p className="max-w-xl text-base leading-relaxed text-black/60">
        There is no workspace at this address.
      </p>
      <Link to="/hub" className={`${primaryPill} mt-8`}>
        Go to my workspace
      </Link>
    </HubShell>
  )
}

// Shown on a 403. Links only to the user's own approved workspaces, never redirects (no loops).
// Exported: StartupJunctionPage reuses this exact component for the same check on /startup-junction.
export function NoAccess({ memberships }) {
  const own = approvedOf(memberships)
  return (
    <HubShell eyebrow="Access" title="You don’t have access to this workspace.">
      <p className="max-w-xl text-base leading-relaxed text-black/60">
        Your account isn’t approved for this workspace.
        {own.length > 0 ? ' These are the workspaces you can open:' : ' Contact the Hub team if you think this is a mistake.'}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {own.map((m) => {
          const p = getPillar(m.pillar)
          return p && pillarHref(p) ? (
            <Link key={m.pillar} to={pillarHref(p)} className={primaryPill}>
              {p.title} →
            </Link>
          ) : null
        })}
        <Link to="/hub" className={secondaryPill}>
          My workspace
        </Link>
      </div>
    </HubShell>
  )
}

// The real workspaces. /hub/startup renders the exact same dashboard as the standalone
// /startup-junction route (see StartupJunctionPage.jsx), not a second hand-built copy.
// HubGate already guarantees signedIn; this only re-checks that this account is approved
// for this pillar (a direct URL visit could otherwise reach an unapproved workspace).
// The API re-checks it again on every call.
function DashboardWorkspace({ pillarId }) {
  const { user, memberships, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const approved = approvedOf(memberships).some((m) => m.pillar === pillarId)
  if (!approved) return <NoAccess memberships={memberships} />
  // Leave /hub/<pillar> before dropping the session: otherwise HubGate's signed-out
  // redirect fires with next=/hub/<pillar> still in the URL, and the next sign-in
  // skips the landing screen straight back into this workspace (destinationAfterLogin
  // honors that next=). /hub is excluded from that bypass, so this always lands back
  // on the landing screen next time in — same as signing out from /startup-junction.
  const handleSignOut = () => {
    navigate('/hub', { replace: true })
    return signOut()
  }
  const Dashboard = DASHBOARDS[pillarId]
  return <Dashboard email={user?.email || ''} onSignOut={handleSignOut} onUnauthorized={refresh} />
}

export default function WorkspacePage() {
  const { pillar: slug } = useParams()
  const pillar = getPillarBySlug(slug)
  if (!pillar) return <NotFound />
  if (DASHBOARDS[pillar.id]) return <DashboardWorkspace key={pillar.id} pillarId={pillar.id} />
  if (pillar.href) return <Navigate to={pillar.href} replace />
  return <NotFound />
}
