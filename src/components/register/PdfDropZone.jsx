// Click-or-drag PDF picker for the Tech-BIP form: dashed orange zone, drag-over state, file name + size,
// replace/remove, and a real upload progress bar (`progress` is 0-100 while uploading, null otherwise).
import { useRef, useState } from 'react'
import { fieldLabel, FieldError, ORANGE_ON_LIGHT } from './RegisterShell.jsx'

const BYTES_PER_MB = 1024 * 1024
export const formatSize = (bytes) => `${(bytes / BYTES_PER_MB).toFixed(bytes < BYTES_PER_MB ? 2 : 1)} MB`

export default function PdfDropZone({ id, label, help, prompt, sub, file, error, progress, disabled, onPick }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const uploading = progress !== null && progress !== undefined
  const choose = (f) => !disabled && f && onPick(f)

  return (
    <div>
      <p id={`${id}-label`} className={fieldLabel}>{label}</p>
      <p className="mt-1 text-xs text-black/50">{help}</p>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files?.[0]) }}
        className={`mt-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${
          over ? 'border-orange bg-orange/10' : error ? 'border-red-500 bg-red-50/40' : 'border-orange/50 bg-[#fff7ed]/60'
        }`}
      >
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="tb-file-input"
          onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }}
        />
        {!file ? (
          <button
            type="button"
            id={id}
            disabled={disabled}
            onClick={() => input.current?.click()}
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-err`}
            aria-invalid={Boolean(error)}
            className="flex min-h-[96px] w-full flex-col items-center justify-center gap-1 rounded-xl px-2 outline-none focus-visible:ring-4 focus-visible:ring-orange/40"
          >
            <span aria-hidden="true" className={`font-mono text-2xl ${ORANGE_ON_LIGHT}`}>↑</span>
            <span className="text-sm font-semibold text-ink">{prompt}</span>
            <span className="text-xs text-black/55">{sub}</span>
          </button>
        ) : (
          <div className="text-left">
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange/15 font-mono text-[10px] font-bold ${ORANGE_ON_LIGHT}`}>PDF</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                <p className="text-xs text-black/55">{formatSize(file.size)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" id={id} disabled={disabled} onClick={() => input.current?.click()} aria-describedby={`${id}-err`}
                  className="min-h-[48px] rounded-full border border-black/20 bg-white px-5 text-sm font-semibold text-ink outline-none hover:border-black/40 focus-visible:ring-4 focus-visible:ring-orange/30 disabled:opacity-50">
                  Replace
                </button>
                <button type="button" disabled={disabled} onClick={() => onPick(null)} aria-label={`Remove ${file.name}`}
                  className="min-h-[48px] rounded-full px-4 text-sm font-semibold text-black/60 outline-none hover:text-ink focus-visible:ring-4 focus-visible:ring-orange/30 disabled:opacity-50">
                  Remove
                </button>
              </div>
            </div>
            {uploading && (
              <div className="mt-4">
                <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-orange transition-[width] duration-200" style={{ width: `${progress}%` }} />
                </div>
                <p className={`mt-1 text-xs font-medium ${ORANGE_ON_LIGHT}`}>Uploading… {progress}%</p>
              </div>
            )}
          </div>
        )}
      </div>
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  )
}
