import { useEffect, useState, useCallback } from 'react'

// Same fetch/loading/error/401 shape as AttendanceView's inline effect,
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
        if (!cancelled) setData(body)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Something went wrong.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url, onUnauthorized, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { loading, error, data, refetch }
}
