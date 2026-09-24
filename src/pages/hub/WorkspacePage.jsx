import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPillar, getPillarBySlug } from '../../data/hubPillars.js'
import { approvedOf } from '../../lib/hubAccess.js'
import { PageSpinner } from './HubGate.jsx'
import HubShell, { primaryPill, secondaryPill } from './HubShell.jsx'
import JunctionDashboard from '../../components/junction/dashboard/JunctionDashboard.jsx'

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
          return p ? (
            <Link key={m.pillar} to={`/hub/${p.slug}`} className={primaryPill}>
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

// Workspace shell only: everything shown (title, nav, name) comes from /api/hub/workspace.
function Workspace({ pillarId }) {
  const { user, memberships, refresh } = useAuth()
  const [state, setState] = useState({ phase: 'loading' }) // loading | ready | forbidden | error
  const [active, setActive] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ phase: 'loading' })
    setActive(0)
    fetch(`/api/hub/workspace?pillar=${encodeURIComponent(pillarId)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (res.status === 401) return refresh() // session gone -> status flips, HubGate sends us to /signin
        if (res.status === 403) return setState({ phase: 'forbidden' })
        if (!res.ok) return setState({ phase: 'error' })
        setState({ phase: 'ready', data: await res.json() })
      })
      .catch((err) => err.name !== 'AbortError' && setState({ phase: 'error' }))
    return () => ctrl.abort()
  }, [pillarId, refresh])

  if (state.phase === 'loading') return <PageSpinner />
  if (state.phase === 'forbidden') return <NoAccess memberships={memberships} />
  if (state.phase === 'error') {
    return (
      <HubShell eyebrow="Brevitty Hub" title="Something went wrong.">
        <p className="max-w-xl text-base text-black/60">We couldn’t load this workspace. Please try again in a moment.</p>
        <button type="button" onClick={() => window.location.reload()} className={`${primaryPill} mt-8`}>
          Reload
        </button>
      </HubShell>
    )
  }

  const { title, nav, user: apiUser } = state.data
  const pending = memberships.filter((m) => m.status === 'pending')
  const item = nav[active]

  return (
    <main className="min-h-screen bg-white px-6 pb-24 pt-28 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-6">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Workspace</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
          </div>
          <p className="text-sm text-black/60">
            Signed in as <span className="font-semibold text-ink">{apiUser.name || user?.email}</span>
          </p>
        </header>

        {pending.length > 0 && (
          <p className="mt-4 rounded-xl border border-[#c2410c]/25 bg-orange/10 px-4 py-2.5 text-sm text-black/70">
            Also under review: {pending.map((m) => getPillar(m.pillar)?.title ?? m.pillar).join(', ')}.
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
          {/* sidebar: a horizontal scroller on phones (scrolls inside itself, not the page) */}
          <nav aria-label={`${title} sections`} className="min-w-0">
            <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
              {nav.map((label, i) => (
                <li key={label} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={i === active ? 'page' : undefined}
                    className={`min-h-[44px] w-full whitespace-nowrap rounded-xl border px-4 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-orange/25 ${
                      i === active
                        ? 'border-orange bg-orange/10 text-ink'
                        : 'border-black/10 bg-white text-black/65 hover:border-black/25 hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section
            aria-live="polite"
            className="flex min-h-[320px] flex-col items-start justify-center rounded-3xl border border-dashed border-black/20 bg-[#fafaf8] p-8 sm:p-12"
          >
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Coming soon</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">{item}</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-black/60">
              This section of your {title} workspace is being built. Nothing to do here yet.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

// The one real workspace: /hub/startup renders the exact same dashboard as the
// standalone /startup-junction route (see StartupJunctionPage.jsx), not a second
// hand-built copy. HubGate already guarantees signedIn; this only re-checks that
// this account is specifically approved for the startup pillar (a direct URL
// visit could otherwise reach an unapproved workspace).
function StartupWorkspace() {
  const { user, memberships, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const approved = approvedOf(memberships).some((m) => m.pillar === 'startup')
  if (!approved) return <NoAccess memberships={memberships} />
  // Leave /hub/startup before dropping the session: otherwise HubGate's signed-out
  // redirect fires with next=/hub/startup still in the URL, and the next sign-in
  // skips the landing screen straight back into this workspace (destinationAfterLogin
  // honors that next=). /hub is excluded from that bypass, so this always lands back
  // on the landing screen next time in — same as signing out from /startup-junction.
  const handleSignOut = () => {
    navigate('/hub', { replace: true })
    return signOut()
  }
  return (
    <JunctionDashboard
      email={user?.email || ''}
      onSignOut={handleSignOut}
      onUnauthorized={refresh}
    />
  )
}

export default function WorkspacePage() {
  const { pillar: slug } = useParams()
  const pillar = getPillarBySlug(slug)
  if (!pillar) return <NotFound />
  if (pillar.id === 'startup') return <StartupWorkspace />
  // key: switching between workspaces remounts, so state never leaks across pillars
  return <Workspace key={pillar.id} pillarId={pillar.id} />
}
