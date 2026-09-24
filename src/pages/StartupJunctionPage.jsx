import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { approvedOf } from '../lib/hubAccess.js'
import JunctionAuthGate from '../components/junction/JunctionAuthGate.jsx'
import JunctionDashboard from '../components/junction/dashboard/JunctionDashboard.jsx'
import { NoAccess } from './hub/WorkspacePage.jsx'

const SESSION_EXPIRED_NOTICE = 'Your session expired, please sign in again.'
const ACCOUNT_LOAD_FAILED_NOTICE = 'Signed in, but we could not load your account. Please try again.'

// Standalone entry point for the Startup Junction workspace: /startup-junction.
// The same signed-in dashboard is also reachable via /hub/startup once signed in
// through the site-wide Hub (see WorkspacePage.jsx) — both render JunctionDashboard.
// Session state comes from AuthContext (not a local /api/me check) so signing in
// or out here keeps the site Navbar and the Hub in sync.
export default function StartupJunctionPage() {
  // checking -> signedIn | signedOut (AuthProvider's /api/me). Nothing private renders until signedIn.
  const { status, user, memberships, refresh, signOut } = useAuth()
  const [notice, setNotice] = useState('')

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <span
          role="status"
          aria-label="Loading"
          className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-orange"
        />
      </div>
    )
  }

  if (status === 'signedOut') {
    return (
      <JunctionAuthGate
        notice={notice}
        onAuthed={async () => {
          setNotice('')
          const account = await refresh() // cookie is set; load the account -> status flips to signedIn
          if (account.status !== 'signedIn') setNotice(ACCOUNT_LOAD_FAILED_NOTICE)
        }}
      />
    )
  }

  // Same approval check /hub/startup enforces (WorkspacePage's StartupWorkspace):
  // a signed-in account that isn't approved for the startup pillar doesn't get in
  // just because it came through this entry point instead. JunctionAuthGate's own
  // sign-in logic is untouched — this only gates what renders after it succeeds.
  const approved = approvedOf(memberships).some((m) => m.pillar === 'startup')
  if (!approved) return <NoAccess memberships={memberships} />

  return (
    <JunctionDashboard
      email={user?.email || ''}
      onSignOut={() => {
        setNotice('')
        return signOut()
      }}
      onUnauthorized={() => {
        setNotice(SESSION_EXPIRED_NOTICE)
        return refresh() // /api/me now 401s -> signedOut -> gate shows the notice
      }}
    />
  )
}
