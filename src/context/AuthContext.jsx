import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

// status: 'checking' (first /api/me in flight) | 'signedOut' | 'signedIn'
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null, memberships: [] })

  // Resolves to the new state so callers (sign-in redirect) don't wait for a re-render.
  const refresh = useCallback(async () => {
    let next = { status: 'signedOut', user: null, memberships: [] } // fail closed on any error
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        next = {
          status: 'signedIn',
          user: { email: data.email, name: data.name || '' },
          memberships: Array.isArray(data.memberships) ? data.memberships : [],
        }
      }
    } catch {
      /* keep signedOut */
    }
    setState(next)
    return next
  }, [])

  const signOut = useCallback(async () => {
    // Even if the request fails the UI drops to signed-out; the cookie is re-verified on every API call.
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
    setState({ status: 'signedOut', user: null, memberships: [] })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => ({ ...state, refresh, signOut }), [state, refresh, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
