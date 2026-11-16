import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import RegisterShell, { fieldLabel, fieldInput, primaryButton, FieldError } from '../../components/register/RegisterShell.jsx'
import { LIMITS } from '../../data/registrationOptions.js'
import { loadRegistration, saveRegistration, hasStep1, isVerifiedPath, isEmail } from '../../lib/registration.js'

const FIELDS = [
  { key: 'department', label: 'Department', placeholder: 'e.g. Computer Science', max: LIMITS.field, auto: 'organization-title' },
  { key: 'course', label: 'Course', placeholder: 'e.g. B.Tech', max: LIMITS.field },
  { key: 'semester', label: 'Semester', placeholder: 'e.g. 5', max: LIMITS.semester, inputMode: 'numeric' },
  { key: 'campusOfficialEmail', label: 'Campus official email', placeholder: 'e.g. placement or coordinator email', max: LIMITS.email, type: 'email' },
  { key: 'studentEmail', label: 'Student email', placeholder: 'Your college-issued email', max: LIMITS.email, type: 'email' },
]

function validate(f) {
  const e = {}
  for (const k of ['department', 'course', 'semester']) if (!f[k].trim()) e[k] = 'This field is required.'
  if (!isEmail(f.campusOfficialEmail)) e.campusOfficialEmail = 'Enter a valid email address.'
  if (!isEmail(f.studentEmail)) e.studentEmail = 'Enter a valid email address.'
  return e
}

export default function RegisterDetailsPage() {
  const navigate = useNavigate()
  const saved = loadRegistration() // studentEmail is prefilled from Step 1
  const [form, setForm] = useState(saved)
  const [errors, setErrors] = useState({})

  // Only the verified campus-student path gets here; everyone else belongs on Step 1.
  if (!hasStep1(saved) || !isVerifiedPath(saved)) return <Navigate to="/register" replace />

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (e) => {
    e.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) return
    saveRegistration({
      department: form.department.trim(),
      course: form.course.trim(),
      semester: form.semester.trim(),
      campusOfficialEmail: form.campusOfficialEmail.trim().toLowerCase(),
      studentEmail: form.studentEmail.trim().toLowerCase(),
    })
    navigate('/register/student')
  }

  return (
    <RegisterShell step="Step 2" title="Your campus details" intro={`Almost there, ${saved.name.split(' ')[0]}. These help us verify you at ${saved.campus}.`}>
      <form
        noValidate
        onSubmit={submit}
        className="rounded-3xl border border-black/10 bg-white/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9"
      >
        {FIELDS.map(({ key, label, placeholder, max, type = 'text', inputMode, auto }, i) => (
          <div key={key}>
            <label htmlFor={`reg-${key}`} className={`${fieldLabel} ${i ? 'mt-2' : ''}`}>{label}</label>
            <input
              id={`reg-${key}`}
              type={type}
              inputMode={inputMode}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              maxLength={max}
              autoComplete={auto}
              placeholder={placeholder}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={`reg-${key}-err`}
              className={fieldInput}
            />
            <FieldError id={`reg-${key}-err`}>{errors[key]}</FieldError>
          </div>
        ))}

        <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/register" className="text-center text-sm font-semibold text-black/60 underline-offset-4 hover:text-ink hover:underline">
            ← Back
          </Link>
          <button type="submit" className={primaryButton}>
            Continue
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </button>
        </div>
      </form>
    </RegisterShell>
  )
}
