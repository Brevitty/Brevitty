// Upload controls shared by every workspace: pick a file -> it goes straight to storage with a
// progress bar -> `onUploaded({ path, name })` saves the path to the row. Errors show inline.
import { useRef, useState } from 'react'
import { ACCEPT, uploadFile, validateFile, fileHref, fileNameOf } from '../../lib/storage.ts'

// { upload(file) -> {path,name} | null, progress (0-100 | null), error, busy }. Never throws.
export function useUpload(target) {
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  async function upload(file) {
    setError('')
    const problem = validateFile(file)
    if (problem) {
      setError(problem)
      return null
    }
    setProgress(0)
    try {
      return await uploadFile(file, target, setProgress)
    } catch (err) {
      setError(err.message || 'The file could not be uploaded. Please try again.')
      return null
    } finally {
      setProgress(null)
    }
  }
  return { upload, progress, error, setError, busy: progress !== null }
}

export function UploadProgress({ progress, label = 'Uploading' }) {
  if (progress === null || progress === undefined) return null
  return (
    <div className="mt-2 w-full max-w-xs" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-orange transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-black/45">
        {label} {progress}%
      </p>
    </div>
  )
}

export function UploadError({ error }) {
  return error ? (
    <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
      {error}
    </p>
  ) : null
}

// A real button in front of a hidden file input (keyboard + screen readers get a normal control).
// onUploaded may be async (the save); the button stays busy until it settles. Returning a string
// from onUploaded shows it as an error.
export function FileUploadButton({ target, label = 'Upload', ariaLabel, onUploaded, disabled, className }) {
  const input = useRef(null)
  const { upload, progress, error, setError } = useUpload(target)
  const [saving, setSaving] = useState(false)

  async function pick(file) {
    const uploaded = await upload(file)
    if (!uploaded) return
    setSaving(true)
    try {
      const problem = await onUploaded(uploaded)
      if (typeof problem === 'string' && problem) setError(problem)
    } catch (err) {
      setError(err.message || 'Could not save the file. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const busy = progress !== null || saving
  return (
    <div className="min-w-0">
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // picking the same file again must still fire onChange
          if (file) pick(file)
        }}
      />
      <button type="button" disabled={disabled || busy} aria-label={ariaLabel} onClick={() => input.current?.click()} className={className}>
        {progress !== null ? `Uploading ${progress}%` : saving ? 'Saving…' : label}
      </button>
      <UploadProgress progress={progress} />
      <UploadError error={error} />
    </div>
  )
}

// "View" link for a stored file (or an older pasted link). Opens in a new tab.
export function FileLink({ stored, children, className = 'font-semibold text-[#c2410c] underline-offset-4 hover:underline dark:text-orange' }) {
  if (!stored) return null
  return (
    <a href={fileHref(stored)} target="_blank" rel="noopener noreferrer" className={`break-all ${className}`} title={fileNameOf(stored)}>
      {children ?? fileNameOf(stored)} ↗
    </a>
  )
}
