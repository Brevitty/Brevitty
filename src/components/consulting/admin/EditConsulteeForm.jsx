// Edit a student's details and/or reset their password (plain text, by design: sir reads it back to them).
import { useState } from 'react'
import { Button, Card, Field, InlineError, Spinner, inputClass, labelClass, ORANGE_TEXT } from '../ui.jsx'
import { admin } from '../../../lib/consultingApi.js'

const FIELDS = [
  { key: 'name', label: 'Full name' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'department', label: 'Department' },
  { key: 'course', label: 'Course' },
  { key: 'sem', label: 'Semester' },
  { key: 'startup_name', label: 'Startup name' },
]

export default function EditConsulteeForm({ consultee, onSaved, onClose }) {
  const [values, setValues] = useState(() => ({
    ...Object.fromEntries(FIELDS.map((f) => [f.key, consultee[f.key] ?? ''])),
    password: consultee.password ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    setError('')
  }

  const generate = async () => {
    try {
      const { password } = await admin.generatePassword()
      setValues((v) => ({ ...v, password }))
    } catch (err) {
      setError(err.message)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await admin.updateConsultee(consultee.email, values)
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Card as="form" onSubmit={submit} className="mt-6 p-6" noValidate>
      <div className="flex items-center justify-between">
        <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${ORANGE_TEXT}`}>Edit student</p>
        <button type="button" onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45 hover:text-ink">
          Close ✕
        </button>
      </div>
      <p className={`${labelClass} mt-4`}>Login email: {consultee.email} (can’t be changed)</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`ec-${f.key}`}>
            <input id={`ec-${f.key}`} type={f.type || 'text'} value={values[f.key]} onChange={set(f.key)} autoComplete="off" className={inputClass} />
          </Field>
        ))}
        <Field label="Password" htmlFor="ec-password" hint="Change it here to reset their login.">
          <div className="flex gap-2">
            <input id="ec-password" value={values.password} onChange={set('password')} autoComplete="off" className={`${inputClass} font-mono`} />
            <Button variant="ghost" onClick={generate} className="shrink-0">
              Generate
            </Button>
          </div>
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={busy}>
          {busy && <Spinner />} Save changes
        </Button>
        <InlineError message={error} />
      </div>
    </Card>
  )
}
