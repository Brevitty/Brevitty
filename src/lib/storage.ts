// The ONLY place the browser touches file storage.
// 1. POST /api/files/upload-url -> our server checks membership + type + size and signs a one-time
//    Supabase upload URL for a path under the caller's own folder (the secret key never reaches here).
// 2. The file is PUT straight to that URL (XHR, for upload progress). Vercel caps request bodies at
//    ~4.5 MB, so files never pass through our API.
// 3. The caller sends the returned `path` to its save endpoint, which re-checks it and stores it.
// Viewing goes through /api/files/view (access-checked, redirects to a 5-minute signed URL): fileHref().
import { unwrap } from './hubApi.js'
import { ACCEPT, FILE_HINT, fileProblem, fileHref, fileNameOf } from '../data/fileRules.js'

export { ACCEPT, FILE_HINT, fileHref, fileNameOf }

export type UploadTarget = { pillar: 'startup' | 'consulting' | 'launchpad' | 'incubation' | 'vac'; docId: string }
export type UploadedFile = { path: string; name: string }

// null when OK, else the reason to show the user.
export const validateFile = (file: File): string | null => fileProblem({ name: file.name, size: file.size })

const statusError = (message: string, status: number) => Object.assign(new Error(message), { status })

async function signUpload(file: File, { pillar, docId }: UploadTarget) {
  let res: Response
  try {
    res = await fetch('/api/files/upload-url', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pillar, doc_id: docId, filename: file.name, size: file.size, type: file.type }),
    })
  } catch {
    throw statusError('Could not reach the server. Check your connection and try again.', 0)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw statusError(body.error || 'The upload could not be started. Please try again.', res.status)
  return unwrap(body) as { path: string; upload_url: string; content_type: string }
}

function put(url: string, file: File, contentType: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(statusError('The file could not be uploaded. Please try again.', xhr.status)))
    xhr.onerror = () => reject(statusError('Upload interrupted. Check your connection and try again.', 0))
    xhr.send(file)
  })
}

export async function uploadFile(file: File, target: UploadTarget, onProgress?: (pct: number) => void): Promise<UploadedFile> {
  const problem = validateFile(file)
  if (problem) throw new Error(problem)
  const { path, upload_url, content_type } = await signUpload(file, target)
  onProgress?.(0)
  await put(upload_url, file, content_type, onProgress)
  return { path, name: file.name }
}
