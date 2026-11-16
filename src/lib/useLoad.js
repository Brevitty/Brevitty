import { useCallback, useEffect, useState } from 'react'

// Runs `loader()` (a consultingApi call) on mount and whenever `deps` change.
// `reload()` refetches without blanking the current data, so saves don't flash a skeleton.
export function useLoad(loader, deps) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: s.data === null, error: '' }))
    loader()
      .then((data) => !cancelled && setState({ loading: false, error: '', data }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: err.message })))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, token])

  const reload = useCallback(() => setToken((t) => t + 1), [])
  // Lets a view apply a server response locally without refetching.
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: fn(s.data) })), [])
  return { ...state, reload, setData }
}
