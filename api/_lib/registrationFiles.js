// Files for the public Startup Junction registration, in the same private Supabase bucket the Hub
// uses (see files.js). The browser PUTs straight to a signed upload URL (Vercel caps bodies at
// ~4.5 MB); this module issues those URLs, and before a row is written it re-checks that every
// object exists and still meets the type and size rules.
//
// Path: registrations/startup-junction/<submission-uuid>/<kind>.<ext>   (the sheet stores this path;
// Hub admins open it through /api/files/view).
import crypto from 'crypto'
import { storage } from './files.js'
import { FILE_KINDS, FILE_FIELDS, fileExt, fileProblem } from '../../src/data/registrationOptions.js'

export const REG_FILES_ROOT = 'registrations/startup-junction'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isSubmissionId = (v) => typeof v === 'string' && UUID_RE.test(v)
export const newSubmissionId = () => crypto.randomUUID()

// "registrations/startup-junction/<uuid>/<kind>.<ext>" only; used by the admin file viewer.
export function isRegistrationPath(path) {
  const p = String(path || '').split('/')
  return p.length === 4 && p[0] === 'registrations' && p[1] === 'startup-junction' && isSubmissionId(p[2]) && /^[a-z-]+\.[a-z]{3,4}$/.test(p[3])
}

const normExt = (ext) => (ext === 'jpeg' ? 'jpg' : ext)
export const objectPath = (submissionId, field, ext) => `${REG_FILES_ROOT}/${submissionId}/${FILE_KINDS[field].kind}.${normExt(ext)}`

// -> { submissionId, path, upload_url, content_type }. Throws a plain Error('...') with .status 400 for bad input.
export async function createRegistrationUpload({ submissionId, field, filename, size, type }) {
  const bad = (msg) => {
    throw Object.assign(new Error(msg), { status: 400 })
  }
  if (!FILE_FIELDS.includes(field)) bad('Unknown file.')
  const id = submissionId ? (isSubmissionId(submissionId) ? submissionId : bad('Invalid submission.')) : newSubmissionId()
  const name = typeof filename === 'string' ? filename.trim() : ''
  if (!name || name.length > 200) bad('File name is required.')
  const problem = fileProblem(field, { name, size: Number(size) })
  if (problem) bad(problem)
  const ext = fileExt(name)
  const contentType = FILE_KINDS[field].types[ext]
  // Browsers report '' for some Office files; anything else must agree with the extension.
  if (type && type !== contentType && !(contentType === 'image/jpeg' && type === 'image/jpg')) bad('The file type does not match its extension.')

  const path = objectPath(id, field, ext)
  // upsert: a retry or a replaced file overwrites in place. The path holds an unguessable uuid, so that is safe.
  const { data, error } = await storage().createSignedUploadUrl(path, { upsert: true })
  if (error) throw new Error(`storage sign upload failed: ${error.message}`)
  return { submissionId: id, path, upload_url: data.signedUrl, content_type: contentType }
}

// Confirms every wanted file exists with an allowed type and size, and returns { field: path }.
// Throws Error with .status 400 if anything is missing/invalid (the caller then removes the folder).
export async function verifyRegistrationFiles(submissionId, wanted) {
  const bad = (msg) => {
    throw Object.assign(new Error(msg), { status: 400 })
  }
  const dir = `${REG_FILES_ROOT}/${submissionId}`
  const { data, error } = await storage().list(dir, { limit: 20 })
  if (error) throw new Error(`storage list failed: ${error.message}`)
  const byName = new Map((data || []).map((o) => [o.name, o]))
  const paths = {}
  for (const [field, ext] of Object.entries(wanted)) {
    const rule = FILE_KINDS[field]
    const obj = byName.get(`${rule.kind}.${normExt(ext)}`)
    const size = Number(obj?.metadata?.size)
    const mime = String(obj?.metadata?.mimetype || '')
    if (!obj || !(size > 0)) bad(`${rule.label} did not finish uploading. Please try again.`)
    if (size > rule.maxBytes) bad(`${rule.label} is too large.`)
    if (!Object.values(rule.types).includes(mime)) bad(`${rule.label} has an unsupported file type.`)
    paths[field] = objectPath(submissionId, field, ext)
  }
  // Drop leftovers (e.g. a replaced file that changed extension).
  const keep = new Set(Object.values(paths).map((p) => p.split('/').pop()))
  const extras = [...byName.keys()].filter((n) => !keep.has(n)).map((n) => `${dir}/${n}`)
  if (extras.length) await storage().remove(extras).catch(() => {})
  return paths
}

// Best effort: used when a submission fails after files were uploaded, so nothing is left behind.
export async function removeRegistrationFiles(submissionId) {
  if (!isSubmissionId(submissionId)) return
  try {
    const dir = `${REG_FILES_ROOT}/${submissionId}`
    const { data } = await storage().list(dir, { limit: 20 })
    if (data?.length) await storage().remove(data.map((o) => `${dir}/${o.name}`))
  } catch (err) {
    console.error(`[register] could not clean up uploaded files: ${err.message}`)
  }
}
