// Supabase Storage for every Hub upload. The secret key never leaves the server: the browser gets a
// signed URL to PUT one file straight to storage (Vercel caps request bodies at ~4.5 MB, so files
// never pass through our API) and, to view, a 5-minute signed URL behind an access check.
// Path layout: {pillar}/{email}/{doc_id}/{timestamp}-{safe_filename}. The sheet stores that path.
import { createClient } from '@supabase/supabase-js'
import { fail, sameEmail } from './consulting/rules.js'
import { fileProblem, fileExt, FILE_TYPES, isLink } from '../../src/data/fileRules.js'

export const FILE_PILLARS = ['startup', 'consulting', 'launchpad', 'incubation', 'vac']
const VIEW_URL_TTL_SECONDS = 300
const MAX_NAME_CHARS = 100
const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

let client = null
export function storage() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) fail(503, 'File uploads are not set up yet. Please contact the Hub team.')
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client.storage.from(process.env.SUPABASE_BUCKET?.trim() || 'hub-files')
}

const safeName = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+/, '').slice(-MAX_NAME_CHARS) || 'file'
const ownerPrefix = (pillar, email) => `${pillar}/${String(email).trim().toLowerCase()}/`

// -> { pillar, owner } for a well-formed path, else null.
export function parsePath(path) {
  const parts = String(path || '').split('/')
  if (parts.length !== 4 || parts.some((p) => !p || p === '.' || p === '..') || !FILE_PILLARS.includes(parts[0])) return null
  return { pillar: parts[0], owner: parts[1] }
}

// body: { pillar, doc_id, filename, size, type }. Membership is checked by the caller.
export async function createUploadUrl(email, body) {
  const pillar = FILE_PILLARS.includes(body.pillar) ? body.pillar : fail(400, 'Unknown workspace.')
  const docId = DOC_ID_PATTERN.test(String(body.doc_id || '')) ? body.doc_id : fail(400, 'Invalid document id.')
  const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
  if (!filename) fail(400, 'File name is required.')
  const problem = fileProblem({ name: filename, size: Number(body.size) })
  if (problem) fail(400, problem)
  const contentType = FILE_TYPES[fileExt(filename)]
  // Browsers report '' for some Office files; anything else must agree with the extension.
  if (body.type && body.type !== contentType && !(fileExt(filename) === 'jpeg' && body.type === 'image/jpeg')) fail(400, 'The file type does not match its extension.')

  const path = `${ownerPrefix(pillar, email)}${docId}/${Date.now()}-${safeName(filename)}`
  const { data, error } = await storage().createSignedUploadUrl(path)
  if (error) throw new Error(`storage sign upload failed: ${error.message}`)
  return { path, upload_url: data.signedUrl, content_type: contentType }
}

// Validates a path a client says it uploaded, before a save endpoint writes it to a row.
// Returns the path, or '' when `required` is false and nothing was sent.
export async function checkUploaded(email, pillar, path, { required = true } = {}) {
  if (path === undefined || path === null || path === '') return required ? fail(400, 'Upload a file first.') : ''
  if (typeof path !== 'string' || !path.startsWith(ownerPrefix(pillar, email)) || !parsePath(path)) fail(400, 'Invalid file.')
  const { data } = await storage().exists(path) // false for a missing object; a network/storage outage throws
  if (!data) fail(400, 'The file did not finish uploading. Please try again.')
  return path
}

// Best effort: an orphaned old object is harmless, a failed save is not. Pasted links are left alone.
export async function removeFile(path) {
  if (!path || isLink(path) || !parsePath(path)) return
  try {
    const { error } = await storage().remove([path])
    if (error) throw error
  } catch (err) {
    console.error(`[files] could not delete an old object: ${err.message}`)
  }
}

export async function signedViewUrl(path) {
  const { data, error } = await storage().createSignedUrl(path, VIEW_URL_TTL_SECONDS)
  if (error) {
    if (/not.?found/i.test(error.message)) fail(404, 'This file is no longer available.')
    throw new Error(`storage sign view failed: ${error.message}`)
  }
  return data.signedUrl
}

export const ownsPath = (email, path) => sameEmail(parsePath(path)?.owner || '', email)
