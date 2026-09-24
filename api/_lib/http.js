// Small helpers shared by the auth routes.

export function allowMethod(req, res, method) {
  if (req.method === method) return true
  res.setHeader('Allow', method)
  res.status(405).json({ error: 'Method not allowed.' })
  return false
}

// Body may arrive parsed (Vercel) or as a raw string (dev bridge / odd clients).
// Returns a plain object, or null if it isn't valid JSON object.
export function readJson(req) {
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}')
    } catch {
      return null
    }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

// Same in-memory style as api/generate.js: best effort, resets on cold start.
export function makeRateLimiter(max, windowMs) {
  const hits = new Map() // ip -> number[]
  return function limited(ip) {
    const now = Date.now()
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      hits.set(ip, recent)
      return true
    }
    recent.push(now)
    hits.set(ip, recent)
    if (hits.size > 5000) hits.clear()
    return false
  }
}
