import { useState } from 'react'
import { motion } from 'framer-motion'
import { Page, ViewHeader, Field, SaveNote, EmptyNote, inputClass, primaryButton, viewItem } from '../hub/ui.jsx'

// First visit of a newly approved learner: enrol in one of the courses the Hub team has scheduled.
// `courses`: [{ course, batches: [] }] from GET /api/hub/vac.
export default function EnrollView({ courses, save }) {
  const [form, setForm] = useState({ name: '', roll_no: '', program: '', semester: '', course: courses[0]?.course || '', batch: '' })
  const [state, setState] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const batches = courses.find((c) => c.course === form.course)?.batches || []

  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await save('vac/enroll', form, (_, res) => res)
    } catch (err) {
      setState({ error: err.message })
    }
  }

  const disabled = state?.saving
  return (
    <Page>
      <ViewHeader eyebrow="Welcome to VAC Learner" title="Enrol in your course." subtitle="Pick the course and batch you are taking. Your schedule, content and assignments open as soon as you enrol." />
      {!courses.length ? (
        <motion.div variants={viewItem} className="mt-10 max-w-xl">
          <EmptyNote>No VAC course has classes scheduled yet. Once the Hub team adds yours, you can enrol here.</EmptyNote>
        </motion.div>
      ) : (
        <motion.form variants={viewItem} onSubmit={submit} className="mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your full name" htmlFor="vac-name">
            <input id="vac-name" required maxLength={120} value={form.name} onChange={set('name')} disabled={disabled} className={inputClass} />
          </Field>
          <Field label="Roll number" htmlFor="vac-roll">
            <input id="vac-roll" required maxLength={40} value={form.roll_no} onChange={set('roll_no')} disabled={disabled} className={inputClass} />
          </Field>
          <Field label="Program (optional)" htmlFor="vac-program">
            <input id="vac-program" maxLength={120} value={form.program} onChange={set('program')} disabled={disabled} className={inputClass} />
          </Field>
          <Field label="Semester (optional)" htmlFor="vac-sem">
            <input id="vac-sem" maxLength={10} inputMode="numeric" value={form.semester} onChange={set('semester')} disabled={disabled} className={inputClass} />
          </Field>
          <Field label="Course" htmlFor="vac-course">
            <select id="vac-course" required value={form.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value, batch: '' }))} disabled={disabled} className={inputClass}>
              {courses.map((c) => (
                <option key={c.course}>{c.course}</option>
              ))}
            </select>
          </Field>
          {batches.length > 0 && (
            <Field label="Batch" htmlFor="vac-batch">
              <select id="vac-batch" required value={form.batch} onChange={set('batch')} disabled={disabled} className={inputClass}>
                <option value="">Choose…</option>
                {batches.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <button type="submit" disabled={disabled} className={primaryButton}>
              {disabled ? 'Enrolling…' : 'Enrol'}
            </button>
            <SaveNote state={state?.error ? { error: state.error } : null} />
          </div>
        </motion.form>
      )}
    </Page>
  )
}
