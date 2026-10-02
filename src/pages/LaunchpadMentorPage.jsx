import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import MentorApp from '../components/launchpad/mentor/MentorApp.jsx'

// /launchpad/mentor — rendered inside HubGate (signed-out visitors go to /signin?next=...).
// Uses the normal Hub session; the API decides mentor access from the LP_Mentors tab.
export default function LaunchpadMentorPage() {
  const { user, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  // Leave the page first so the signed-out redirect doesn't carry next=/launchpad/mentor.
  const handleSignOut = () => {
    navigate('/signin', { replace: true })
    return signOut()
  }
  return <MentorApp email={user?.email || ''} onSignOut={handleSignOut} onUnauthorized={refresh} />
}
