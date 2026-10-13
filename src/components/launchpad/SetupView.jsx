import { useState } from 'react'
import { motion } from 'framer-motion'
import { Page, ViewHeader, Field, SaveNote, inputClass, primaryButton, viewItem } from '../hub/ui.jsx'

// First visit of a newly approved student: they create their own Launchpad record.
// `save` folds the response (the whole new workspace) into the loaded data, so the views open at once.
export default function SetupView({ save }) {
  const [form, setForm] = useState({ name: '', grade: '', school: '', guardian_name: '', guardian_contact: '', guardian_consent: false })
  const [state, setState] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await save('launchpad/setup', form, (_, res) => res)
    } catch (err) {
      setState({ error: err.message })
    }
  }

  const disabled = state?.saving
  return (
    <Page>
      <ViewHeader eyebrow="Welcome to Launchpad Abroad" title="Set up your profile." subtitle="A few details to start. Your checklist, profile, sessions and documents open as soon as you save." />
      <motion.form variants={viewItem} onSubmit={submit} className="mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Your full name" htmlFor="lp-name">
          <input id="lp-name" required maxLength={120} value={form.name} onChange={set('name')} disabled={disabled} className={inputClass} />
        </Field>
        <Field label="Grade" htmlFor="lp-grade">
          <input id="lp-grade" required maxLength={10} inputMode="numeric" value={form.grade} onChange={set('grade')} disabled={disabled} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="School" htmlFor="lp-school">
            <input id="lp-school" required maxLength={200} value={form.school} onChange={set('school')} disabled={disabled} className={inputClass} />
          </Field>
        </div>
        <Field label="Parent / guardian name" htmlFor="lp-guardian">
          <input id="lp-guardian" required maxLength={120} value={form.guardian_name} onChange={set('guardian_name')} disabled={disabled} className={inputClass} />
        </Field>
        <Field label="Parent / guardian phone or email (optional)" htmlFor="lp-guardian-contact">
          <input id="lp-guardian-contact" maxLength={120} value={form.guardian_contact} onChange={set('guardian_contact')} disabled={disabled} className={inputClass} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-ink sm:col-span-2">
          <input type="checkbox" required checked={form.guardian_consent} onChange={(e) => setForm((f) => ({ ...f, guardian_consent: e.target.checked }))} disabled={disabled} className="mt-0.5 h-4 w-4 accent-orange" />
          My parent or guardian has agreed to my taking part in Launchpad Abroad.
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="submit" disabled={disabled} className={primaryButton}>
            {disabled ? 'Saving…' : 'Start my journey'}
          </button>
          <SaveNote state={state?.error ? { error: state.error } : null} />
        </div>
      </motion.form>
    </Page>
  )
}
