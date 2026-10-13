// /hub/consulting-admin/* : sir's panel. Sits under HubGate (signed-out -> /signin). The role comes from
// /api/consulting/me, and every admin API route re-checks it server-side (403), so this screen is UX only.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHideSiteChrome } from '../../context/ChromeVisibilityContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { me, setUnauthorizedHandler } from '../../lib/consultingApi.js'
import { ROLES } from '../../data/consultingConstants.js'
import AdminApp from '../../components/consulting/admin/AdminApp.jsx'
import HubShell, { primaryPill, secondaryPill } from './HubShell.jsx'
import { PageSpinner } from './HubGate.jsx'

export default function ConsultingAdminPage() {
  const { signOut: hubSignOut } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState({ phase: 'checking', account: null }) // checking | admin | denied | error
  const isAdmin = state.phase === 'admin'
  useHideSiteChrome(isAdmin)

  useEffect(() => {
    me()
      .then((account) => setState({ phase: account.role === ROLES.admin ? 'admin' : 'denied', account }))
      .catch((err) => setState({ phase: err.status === 401 || err.status === 403 ? 'denied' : 'error', account: null }))
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setState({ phase: 'denied', account: null }))
    return () => setUnauthorizedHandler(() => {})
  }, [])

  const signOut = useCallback(async () => {
    navigate('/hub', { replace: true })
    await hubSignOut()
  }, [navigate, hubSignOut])

  if (state.phase === 'checking') return <PageSpinner />
  if (state.phase === 'error') {
    return (
      <HubShell eyebrow="Consulting admin" title="Something went wrong.">
        <p className="max-w-xl text-base text-black/60">We couldn’t load the admin panel. Please try again in a moment.</p>
        <button type="button" onClick={() => window.location.reload()} className={`${primaryPill} mt-8`}>
          Reload
        </button>
      </HubShell>
    )
  }
  if (state.phase === 'denied') {
    return (
      <HubShell eyebrow="Consulting admin" title="You don’t have access to this page.">
        <p className="max-w-xl text-base leading-relaxed text-black/60">
          This panel is only for the consultant. If you think this is a mistake, ask the Hub team to add your email to the Admins sheet.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/hub/choose" className={primaryPill}>
            My workspace
          </Link>
          <Link to="/" className={secondaryPill}>
            Back to site
          </Link>
        </div>
      </HubShell>
    )
  }
  return <AdminApp account={state.account} onSignOut={signOut} />
}
