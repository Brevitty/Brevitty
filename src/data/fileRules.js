// Upload rules shared by the browser (pre-check) and api/_lib/files.js (enforced), so the server
// refuses exactly what the forms promise. Files live in Supabase Storage; Sheets only keep the path.

export const MAX_FILE_MB = 25
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
export const FILE_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}
export const ACCEPT = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(',')
export const FILE_HINT = `PDF, Word, PowerPoint, Excel, PNG or JPG · max ${MAX_FILE_MB} MB`

export const fileExt = (name) => String(name).split('.').pop().toLowerCase()

// null when the file is acceptable, else a user-facing reason.
export function fileProblem({ name, size }) {
  if (!Object.hasOwn(FILE_TYPES, fileExt(name))) return 'Only PDF, Word, PowerPoint, Excel, PNG or JPG files are allowed.'
  if (size !== undefined && !(size > 0)) return 'That file is empty.'
  if (size > MAX_FILE_BYTES) return `File is too large (max ${MAX_FILE_MB} MB).`
  return null
}

// Older rows may still hold a pasted https link; new ones hold a storage path.
export const isLink = (v) => /^https?:\/\//i.test(String(v || ''))

// "consulting/a@b.com/dlv_1/1760000000000-Pitch_deck.pdf" -> "Pitch_deck.pdf"
export const fileNameOf = (stored) => {
  if (!stored) return ''
  if (isLink(stored)) {
    try {
      return new URL(stored).hostname.replace(/^www\./, '')
    } catch {
      return stored
    }
  }
  return String(stored).split('/').pop().replace(/^\d+-/, '')
}

// Where a "View" link points: a stored path goes through our access-checked redirect.
export const fileHref = (stored) => (isLink(stored) ? stored : `/api/files/view?path=${encodeURIComponent(stored)}`)
