import { useState } from 'react'
import { Button, Spinner, inputClass, InlineError } from '../ui.jsx'

// One form for both "add a deliverable" (title + link) and "submit a link" on an existing one (link only).
export default function DeliverableForm({ withTitle, submitLabel = 'Save', onSubmit, onCancel }) {
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit({ title: title.trim(), link: link.trim() })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 rounded-xl border border-orange/25 bg-orange/[0.04] p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {withTitle && (
          <input
            aria-label="Deliverable title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Pricing sheet v1"
            className={`${inputClass} sm:max-w-[16rem]`}
          />
        )}
        <input
          aria-label="Link"
          type="url"
          required
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://docs.google.com/…"
          className={inputClass}
          autoFocus={!withTitle}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Spinner className="h-3 w-3" />} {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <InlineError message={error} />
      </div>
    </form>
  )
}
