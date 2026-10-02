// /consulting/* : one gate for both consulting surfaces. It has its own cookie and
// /api/consulting/me, but sign-in and sign-out are the shared Hub ones, so the site-wide
// AuthContext is refreshed alongside. Signed out sees only the sign-in; the server-reported
// role decides which app renders, and the API re-checks the role on every call.
import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useHideSiteChrome } from '../context/ChromeVisibilityContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { me, setUnauthorizedHandler } from '../lib/consultingApi.js'
import { ROLES } from '../data/consultingConstants.js'
import ConsultingSignIn from '../components/consulting/ConsultingSignIn.jsx'
import StudentApp from '../components/consulting/student/StudentApp.jsx'
import AdminApp from '../components/consulting/admin/AdminApp.jsx'

const EXPIRED_NOTICE = 'Your session expired. Please sign in again.'

export default function ConsultingPage() {
  useHideSiteChrome(true)
  const navigate = useNavigate()
  const hub = useAuth()
  // { status: 'checking' | 'signedOut' | 'signedIn', account, notice }
  const [auth, setAuth] = useState({ status: 'checking', account: null, notice: '' })

  useEffect(() => {
    me()
      .then((account) => setAuth({ status: 'signedIn', account, notice: '' }))
      .catch(() => setAuth({ status: 'signedOut', account: null, notice: '' }))
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setAuth({ status: 'signedOut', account: null, notice: EXPIRED_NOTICE }))
    return () => setUnauthorizedHandler(() => {})
  }, [])

  const signOut = useCallback(async () => {
    await hub.signOut() // clears every workspace cookie; the UI drops to signed-out either way
    setAuth({ status: 'signedOut', account: null, notice: '' })
    navigate('/consulting', { replace: true })
  }, [navigate, hub.signOut])

  if (auth.status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafaf8]">
        <span role="status" aria-label="Loading" className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-orange" />
      </div>
    )
  }

  if (auth.status === 'signedOut') {
    return <ConsultingSignIn
        notice={auth.notice}
        onSignedIn={(account) => {
          setAuth({ status: 'signedIn', account, notice: '' })
          hub.refresh() // the same sign-in opened the other workspaces too
        }}
      />
  }

  const isAdmin = auth.account.role === ROLES.admin
  return (
    <Routes>
      <Route
        path="admin/*"
        element={isAdmin ? <AdminApp account={auth.account} onSignOut={signOut} /> : <Navigate to="/consulting" replace />}
      />
      <Route
        path="*"
        element={isAdmin ? <Navigate to="/consulting/admin" replace /> : <StudentApp account={auth.account} onSignOut={signOut} />}
      />
    </Routes>
  )
}
