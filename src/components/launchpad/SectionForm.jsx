import { useState } from 'react'
import { Field, SaveNote, inputClass, primaryButton } from '../hub/ui.jsx'

// Edits one PROFILE_SECTIONS section (text / textarea / link fields; `student`-sourced fields
// are skipped: they come from the intake record). Saves only the fields that
// changed, one LP_Profile row each.
export default function SectionForm({ section, profile, onSaveField }) {
  const fields = section.fields.filter((f) => f.source !== 'student')
  const initial = () => Object.fromEntries(fields.map((f) => [f.id, profile[`${section.id}.${f.id}`] || '']))
  const [values, setValues] = useState(initial)
  const [state, setState] = useState(null)
  const dirty = fields.filter((f) => values[f.id].trim() !== (profile[`${section.id}.${f.id}`] || ''))

  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      for (const f of dirty) await onSaveField(section.id, f.id, values[f.id].trim())
      setState({ saved: true })
    } catch (err) {
      setState({ error: err.message })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map((f) => {
        const id = `lp-${section.id}-${f.id}`
        const common = {
          id,
          value: values[f.id],
          onChange: (e) => {
            setValues((v) => ({ ...v, [f.id]: e.target.value }))
            setState(null)
          },
          className: inputClass,
        }
        return (
          <Field key={f.id} label={f.label} htmlFor={id} hint={f.hint}>
            {f.kind === 'textarea' ? (
              <textarea rows={3} maxLength={2000} {...common} />
            ) : (
              <input type={f.kind === 'link' ? 'url' : 'text'} maxLength={f.kind === 'link' ? 2000 : 200} placeholder={f.kind === 'link' ? 'https://' : ''} {...common} />
            )}
          </Field>
        )
      })}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!dirty.length || state?.saving} className={primaryButton}>
          Save {section.title.toLowerCase()}
        </button>
        <SaveNote state={state} />
      </div>
    </form>
  )
}
