// Form building blocks shared by the registration pages that collect details (Junction, Arena).
import { fieldLabel, FieldError } from './RegisterShell.jsx'
import { FILE_KINDS } from '../../data/registrationOptions.js'

const formatMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`

export function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className={`${fieldLabel} mt-2`}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-black/50">{hint}</p>}
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  )
}

// A styled file picker. The file is only held in memory here; nothing uploads until the form is valid and submitted.
export function FileField({ field, file, error, onPick, hint }) {
  const rule = FILE_KINDS[field]
  const id = `sj-${field}`
  return (
    <Field id={id} label={rule.label} error={error} hint={hint || rule.hint}>
      <div className="mt-1.5 flex min-h-[48px] items-center gap-3 rounded-xl border border-black/20 bg-white px-3 py-2">
        <label
          htmlFor={id}
          className="cursor-pointer rounded-full bg-orange/10 px-4 py-2 text-sm font-semibold text-[#c2410c] focus-within:ring-4 focus-within:ring-orange/30 hover:bg-orange/20"
        >
          {file ? 'Replace' : 'Choose file'}
        </label>
        <input
          id={id}
          type="file"
          className="sr-only"
          accept={Object.keys(rule.types).map((x) => `.${x}`).join(',')}
          onChange={(e) => onPick(field, e.target.files?.[0] || null)}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-err`}
        />
        <span className="min-w-0 flex-1 truncate text-sm text-black/60">
          {file ? `${file.name} · ${formatMb(file.size)}` : 'No file chosen'}
        </span>
        {file && (
          <button type="button" onClick={() => onPick(field, null)} className="text-xs font-semibold text-black/50 hover:text-ink" aria-label={`Remove ${rule.label}`}>
            Remove
          </button>
        )}
      </div>
    </Field>
  )
}
