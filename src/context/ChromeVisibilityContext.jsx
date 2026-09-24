import { createContext, useContext, useLayoutEffect } from 'react'

// Lets a page hide the global site Navbar/Footer while it's mounted (e.g. the
// signed-in Startup Junction dashboard, which is its own full-screen app shell).
// Purely a layout signal — unrelated to any page's own auth/session state.
const ChromeVisibilityContext = createContext(() => {})

export const ChromeVisibilityProvider = ChromeVisibilityContext.Provider

export function useHideSiteChrome(hidden) {
  const setHidden = useContext(ChromeVisibilityContext)
  // Layout effect, not useEffect: hide before the first paint, otherwise the
  // site Navbar/Footer flash over the dashboard for a frame on mount.
  useLayoutEffect(() => {
    setHidden(hidden)
    return () => setHidden(false)
  }, [hidden, setHidden])
}
