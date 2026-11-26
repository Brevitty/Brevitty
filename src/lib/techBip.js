// Browser side of the Tech-BIP 2027 registration: JSON calls to /api/register (form: 'tech-bip') and the PDF upload.
// Order: the server signs an upload URL -> we PUT the PDF straight to storage (XHR, for real progress) -> only then
// is the registration posted, and the server re-verifies the stored file before it writes the row.
import { TECH_BIP_FORM, PDF_MIME } from '../data/techBip.js'

const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.'
const GENERIC_ERROR = 'Something went wrong. Please try again.'
const UPLOAD_ERROR = 'The file could not be uploaded. Please try again.'
const HTTP_CONFLICT = 409

// -> { status: 'ok' | 'already' | 'error', message, data }
async function post(body) {
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: TECH_BIP_FORM, ...body }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return { status: 'ok', data: json.data }
    if (res.status === HTTP_CONFLICT) return { status: 'already', message: json.error }
    return { status: 'error', message: json.error || GENERIC_ERROR }
  } catch {
    return { status: 'error', message: NETWORK_ERROR }
  }
}

// PUT the file with upload progress. Resolves to null on success or a user-facing message.
function putWithProgress(url, file, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', PDF_MIME)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? null : UPLOAD_ERROR)
    xhr.onerror = () => resolve('Upload interrupted. Check your connection and try again.')
    xhr.onabort = xhr.onerror
    xhr.send(file)
  })
}

// `values` is the normalised form (see normaliseTechBip). onStage('uploading' | 'saving'); onProgress(0-100).
// -> { status, message, data: { registrationId } }
export async function submitTechBip(values, file, honeypot, { onStage = () => {}, onProgress = () => {} } = {}) {
  let submissionId = ''
  const abort = async (result) => {
    if (submissionId) await post({ action: 'discard', submissionId })
    return result
  }
  onStage('uploading')
  onProgress(0)
  const signed = await post({ action: 'upload-url', email: values.email, filename: file.name, size: file.size, type: file.type })
  if (signed.status !== 'ok') return signed
  submissionId = signed.data.submissionId
  const problem = await putWithProgress(signed.data.upload_url, file, onProgress)
  if (problem) return abort({ status: 'error', message: problem })

  onStage('saving')
  const saved = await post({ ...values, submissionId, website: honeypot })
  return saved.status === 'ok' ? saved : abort(saved)
}
