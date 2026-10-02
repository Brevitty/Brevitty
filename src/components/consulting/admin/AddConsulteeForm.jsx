import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button, Card, Field, InlineError, Spinner, inputClass, labelClass, ORANGE_TEXT, ease } from '../ui.jsx'
import { admin } from '../../../lib/consultingApi.js'
import { paths } from './paths.js'

const FIELDS = [
  { key: 'name', label: 'Full name', required: true, autoComplete: 'off' },
  { key: 'email', label: 'Official email', type: 'email', required: true },
  { key: 'phone', label: 'Phone', type: 'tel', inputMode: 'tel' },
  { key: 'department', label: 'Department' },
  { key: 'course', label: 'Course', placeholder: 'B.Tech, BBA…' },
  { key: 'sem', label: 'Semester', inputMode: 'numeric' },
  { key: 'startup_name', label: 'Startup name' },
]
const EMPTY = Object.fromEntries([...FIELDS.map((f) => [f.key, '']), ['password', '']])

const loginMessage = (c) =>
  `Hi ${c.name.split(/\s+/)[0]}, your consulting workspace is ready.\n${window.location.origin}/consulting\nEmail: ${c.email}\nPassword: ${c.password}`

function Credentials({ consultee, onAnother }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(loginMessage(consultee))
      setCopied(true)
    } catch {
      setCopied(false) // clipboard blocked: the details stay visible to copy by hand
    }
  }
  return (
    <Card className="overflow-hidden border-ink">
      <div className="bg-ink px-6 py-5 text-white">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">[OK] Account created</p>
        <p className="mt-2 font-display text-2xl font-bold">{consultee.name}</p>
      </div>
      <dl className="grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <dt className={labelClass}>Login email</dt>
          <dd className="mt-1 break-all font-mono text-sm text-ink">{consultee.email}</dd>
        </div>
        <div>
          <dt className={labelClass}>Password</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tracking-wider text-ink">{consultee.password}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2 border-t border-black/10 px-6 py-4">
        <Button variant="primary" size="sm" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy login message'}
        </Button>
        <Link to={paths.schedule(consultee.email)} className="inline-flex min-h-[36px] items-center rounded-full bg-ink px-3.5 text-xs font-semibold text-white">
          Schedule first session
        </Link>
        <Button variant="ghost" size="sm" onClick={onAnother}>
          Add another
        </Button>
      </div>
    </Card>
  )
}

export default function AddConsulteeForm({ onCreated, onClose }) {
  const [values, setValues] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    setError('')
  }

  const generate = async () => {
    setGenBusy(true)
    try {
      const { password } = await admin.generatePassword()
      setValues((v) => ({ ...v, password }))
    } catch (err) {
      setError(err.message)
    } finally {
      setGenBusy(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { consultee } = await admin.createConsultee(values)
      setCreated(consultee)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="mt-6">
      {created ? (
        <Credentials
          consultee={created}
          onAnother={() => {
            setCreated(null)
            setValues(EMPTY)
          }}
        />
      ) : (
        <Card as="form" onSubmit={submit} className="p-6" noValidate>
          <div className="flex items-center justify-between">
            <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${ORANGE_TEXT}`}>New consultee</p>
            <button type="button" onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45 hover:text-ink">
              Close ✕
            </button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`} htmlFor={`nc-${f.key}`}>
                <input
                  id={`nc-${f.key}`}
                  type={f.type || 'text'}
                  inputMode={f.inputMode}
                  required={f.required}
                  autoComplete={f.autoComplete || 'off'}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={set(f.key)}
                  className={inputClass}
                />
              </Field>
            ))}
            <Field label="Password *" htmlFor="nc-password" hint="Plain text in the sheet, so you can read it back later.">
              <div className="flex gap-2">
                <input id="nc-password" value={values.password} onChange={set('password')} autoComplete="off" className={`${inputClass} font-mono`} />
                <Button variant="ghost" onClick={generate} disabled={genBusy} className="shrink-0">
                  {genBusy ? <Spinner /> : 'Generate'}
                </Button>
              </div>
            </Field>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={busy}>
              {busy && <Spinner />} Create account
            </Button>
            <InlineError message={error} />
          </div>
        </Card>
      )}
    </motion.div>
  )
}
