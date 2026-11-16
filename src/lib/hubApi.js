// The Incubation API answers {ok, data, error}; every other route answers the bare payload.
export const unwrap = (body) => (body?.ok === true && 'data' in body ? body.data : body)

// Writes to /api/hub/* for the Launchpad / Incubation / VAC workspaces (reads go through
// useJunctionFetch). Throws an Error carrying the server's message and `status`.
export async function hubPost(path, body) {
  let res
  try {
    res = await fetch(`/api/hub/${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { status: 0 })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status })
  return unwrap(data)
}

const IST_TZ = 'Asia/Kolkata'
// '2026-10-07' -> 'Oct 7, 2026'
export const formatDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
// '17:30' -> '5:30 PM IST'
export function formatTime(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return hhmm || ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'} IST`
}
export const istTodayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: IST_TZ })
