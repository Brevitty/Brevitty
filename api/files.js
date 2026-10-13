// /api/files/* — uploads and downloads for every Hub workspace (see api/_lib/files.js).
//   POST upload-url  {pillar, doc_id, filename, size, type} -> {path, upload_url, content_type}
//                    needs an approved membership in that pillar; the path is always the caller's own.
//   GET  view?path=  302 to a 5-minute signed URL. Allowed for the file's owner, a Hub admin, and
//                    (Launchpad files only) a Launchpad mentor. Opened in a new tab, so errors are HTML.
import { readJson } from './_lib/http.js'
import { currentIdentity } from './_lib/signIn.js'
import { ApiError } from './_lib/consulting/rules.js'
import { createUploadUrl, signedViewUrl, parsePath, ownsPath } from './_lib/files.js'
import { isLaunchpadMentor } from './_lib/launchpadSheet.js'

const hasPillar = (identity, id) => identity.memberships.some((m) => m.pillar === id && m.status === 'approved')

function routeOf(url) {
  const p = url.searchParams.get('p') ?? url.pathname.replace(/^\/(api\/)?files\/?/, '')
  return p.replace(/^\/+|\/+$/g, '')
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
function htmlError(res, status, message) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>File unavailable</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#111">` +
      `<h1 style="font-size:1.25rem">File unavailable</h1><p>${escapeHtml(message)}</p><p><a href="/hub" style="color:#ea580c">Back to the Hub</a></p></body>`
  )
}

async function canView(identity, path) {
  const parsed = parsePath(path)
  if (!parsed) return false
  if (ownsPath(identity.email, path) || hasPillar(identity, 'admin')) return true
  return parsed.pillar === 'launchpad' && (await isLaunchpadMentor(identity.email))
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const url = new URL(req.url || '', 'http://localhost')
  const route = routeOf(url)
  const isView = req.method === 'GET' && route === 'view'
  const isUpload = req.method === 'POST' && route === 'upload-url'
  if (!isView && !isUpload) return res.status(404).json({ ok: false, error: 'Not found.' })

  try {
    const identity = await currentIdentity(req)
    if (!identity) throw new ApiError(401, isView ? 'Sign in to the Hub to open this file.' : 'Not signed in.')

    if (isView) {
      const path = url.searchParams.get('path') || ''
      if (!(await canView(identity, path))) throw new ApiError(403, 'You do not have access to this file.')
      res.statusCode = 302
      res.setHeader('Location', await signedViewUrl(path))
      return res.end()
    }

    const body = readJson(req)
    if (!body) throw new ApiError(400, 'Request body must be a JSON object.')
    if (!hasPillar(identity, body.pillar)) throw new ApiError(403, 'You do not have access to this workspace.')
    return res.status(200).json({ ok: true, data: await createUploadUrl(identity.email, body) })
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 503
    const message = err instanceof ApiError ? err.message : 'File storage is temporarily unavailable. Please try again in a few minutes.'
    if (!(err instanceof ApiError)) console.error(`[files:${route}] ${err.message}`)
    return isView ? htmlError(res, status, message) : res.status(status).json({ ok: false, error: message })
  }
}
