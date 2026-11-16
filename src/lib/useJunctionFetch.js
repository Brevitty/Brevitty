import { useEffect, useState, useCallback } from 'react'
import { unwrap } from './hubApi.js'

// Same fetch/loading/error/401 shape as the other dashboard views' effects,
// extracted so the other Sheets-backed dashboard tabs don't each hand-roll it.
export function useJunctionFetch(url, onUnauthorized) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(url)
      .then(async (res) => {
        if (res.status === 401) return onUnauthorized()
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Something went wrong.')
        if (!cancelled) setData(unwrap(body))
      })
      .catch((err) => {
        // A TypeError here is the network itself (offline, DNS, CORS), not a server message.
        const message = err instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : err.message
        if (!cancelled) setError(message || 'Something went wrong.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url, onUnauthorized, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  // setData lets a view apply a write's response locally instead of refetching.
  return { loading, error, data, refetch, setData }
}
