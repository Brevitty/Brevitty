import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { landingPath } from '../../lib/hubAccess.js'

// /hub — runs the redirect logic (HubGate has already guaranteed signedIn).
export default function HubIndexPage() {
  const { memberships } = useAuth()
  return <Navigate to={landingPath(memberships)} replace />
}
