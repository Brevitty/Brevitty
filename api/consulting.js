// /api/consulting/* — ONE serverless function that dispatches every consulting route
// (the project is at Vercel Hobby's 12-function ceiling; see vercel.json rewrite and the
// dev-bridge prefix fallback in vite.config.js). Route modules: api/_lib/consulting/routes/.
import { readJson } from './_lib/http.js'
import { ApiError } from './_lib/consulting/rules.js'
import { authorize } from './_lib/consulting/auth.js'
import authRoutes from './_lib/consulting/routes/auth.js'
import studentRoutes from './_lib/consulting/routes/student.js'
import adminRoutes from './_lib/consulting/routes/admin.js'
import adminSessionRoutes from './_lib/consulting/routes/adminSessions.js'

const ROUTES = { ...authRoutes, ...studentRoutes, ...adminRoutes, ...adminSessionRoutes }
const BODY_METHODS = new Set(['POST', 'PATCH', 'PUT'])
const UNAVAILABLE = 'The consulting workspace is temporarily unavailable. Please try again in a few minutes.'

// Vercel rewrites to /api/consulting?p=<route>; the dev bridge leaves /consulting/<route>. Accept both.
function routeOf(url) {
  const p = url.searchParams.get('p')
  const path = p ?? url.pathname.replace(/^\/(api\/)?consulting\/?/, '')
  return path.replace(/^\/+|\/+$/g, '')
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const url = new URL(req.url, 'http://localhost')
    const route = routeOf(url)
    const entry = ROUTES[`${req.method} ${route}`]
    if (!entry) {
      const allowed = Object.keys(ROUTES).filter((k) => k.endsWith(` ${route}`)).map((k) => k.split(' ')[0])
      if (allowed.length) {
        res.setHeader('Allow', allowed.join(', '))
        throw new ApiError(405, 'Method not allowed.')
      }
      throw new ApiError(404, 'Not found.')
    }

    let body = {}
    if (BODY_METHODS.has(req.method)) {
      body = readJson(req)
      if (!body) throw new ApiError(400, 'Request body must be a JSON object.')
    }
    const query = Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'p'))
    const account = entry.auth === 'none' ? null : await authorize(req, entry.auth)

    const data = await entry.fn({ req, res, body, query, account })
    return res.status(entry.status ?? 200).json(data)
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message })
    console.error(`[consulting] ${err.message}`) // never log bodies: they can hold passwords
    return res.status(503).json({ error: UNAVAILABLE })
  }
}
