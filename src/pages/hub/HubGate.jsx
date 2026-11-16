import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export function PageSpinner() {
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

// Layout route for /hub/*: nothing hub-related renders until we know who you are.
// (UI gating only — every workspace also calls /api/hub/workspace, which enforces access.)
export default function HubGate() {
  const { status } = useAuth()
  const { pathname, search } = useLocation()

  if (status === 'checking') return <PageSpinner />
  if (status === 'signedOut') {
    return <Navigate to={`/signin?next=${encodeURIComponent(pathname + search)}`} replace />
  }
  return <Outlet />
}
