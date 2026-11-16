import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RegisterShell, { fieldLabel, fieldInput, primaryButton, FieldError, StudentEmailNote } from '../../components/register/RegisterShell.jsx'
import { VERIFIED_CAMPUSES, OTHER_CAMPUS, LIMITS, normalisePhone } from '../../data/registrationOptions.js'
import { loadRegistration, saveRegistration, nextRoute, isEmail, isPhone } from '../../lib/registration.js'

const CAMPUS_CHOICES = [...VERIFIED_CAMPUSES, OTHER_CAMPUS]

function validate(f) {
  const e = {}
  if (f.name.trim().length < 2) e.name = 'Enter your full name.'
  if (!f.collegeStudent) e.collegeStudent = 'Tell us if you are a college student.'
  if (f.collegeStudent === 'Yes' && !f.campus) e.campus = 'Choose your campus.'
  if (!isEmail(f.email)) e.email = 'Enter a valid email address.'
  if (!isPhone(f.phone)) e.phone = 'Enter a 10-digit mobile number.'
  // Optional: giving it unlocks the verified path (Step 2 + Startup Junction/Arena); leaving it blank goes to the open options.
  if (VERIFIED_CAMPUSES.includes(f.campus) && f.studentEmail.trim() && !isEmail(f.studentEmail)) e.studentEmail = 'Enter a valid email address.'
  return e
}

function YesNo({ value, onChange, invalid }) {
  return (
    <div role="radiogroup" aria-label="Are you a college student?" aria-invalid={invalid || undefined} className="mt-1.5 flex gap-3">
      {['Yes', 'No'].map((opt) => {
        const on = value === opt
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt)}
            className={`min-h-[48px] flex-1 rounded-full border px-6 text-sm font-semibold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-orange/30 ${
              on ? 'border-orange bg-orange text-white' : 'border-black/20 bg-white text-ink hover:border-black/40'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => loadRegistration()) // back-navigation keeps what they typed
  const [errors, setErrors] = useState({})

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch)) delete next[k]
      return next
    })
  }

  const onStudentChange = (v) => set({ collegeStudent: v, ...(v === 'No' ? { campus: '', studentEmail: '' } : {}) })
  const onCampusChange = (campus) =>
    set({ campus, ...(VERIFIED_CAMPUSES.includes(campus) ? {} : { studentEmail: '' }) }) // student email only applies to the four campuses

  const submit = (e) => {
    e.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) return
    const clean = {
      name: form.name.trim(),
      collegeStudent: form.collegeStudent,
      campus: form.collegeStudent === 'Yes' ? form.campus : '',
      email: form.email.trim().toLowerCase(),
      phone: normalisePhone(form.phone.trim()),
      studentEmail: VERIFIED_CAMPUSES.includes(form.campus) ? form.studentEmail.trim().toLowerCase() : '',
    }
    // Leaving the verified path (e.g. changed campus) must not keep stale Step-2 answers.
    const reset = clean.studentEmail ? {} : { department: '', course: '', semester: '' }
    saveRegistration({ ...clean, ...reset })
    navigate(nextRoute({ ...form, ...clean, ...reset }))
  }

  const showCampus = form.collegeStudent === 'Yes'
  const showStudentEmail = showCampus && VERIFIED_CAMPUSES.includes(form.campus)

  return (
    <RegisterShell step="Step 1" title="Register with Brevitty" intro="Tell us a little about you. It takes under a minute.">
      <form
        noValidate
        onSubmit={submit}
        className="rounded-3xl border border-black/10 bg-white/90 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-9"
      >
        <label htmlFor="reg-name" className={fieldLabel}>Name</label>
        <input
          id="reg-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          maxLength={LIMITS.name}
          autoComplete="name"
          placeholder="Your full name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby="reg-name-err"
          className={fieldInput}
        />
        <FieldError id="reg-name-err">{errors.name}</FieldError>

        <span className={`${fieldLabel} mt-2`}>Are you a college student?</span>
        <YesNo value={form.collegeStudent} onChange={onStudentChange} invalid={Boolean(errors.collegeStudent)} />
        <FieldError>{errors.collegeStudent}</FieldError>

        {showCampus && (
          <>
            <label htmlFor="reg-campus" className={`${fieldLabel} mt-2`}>Campus</label>
            <select
              id="reg-campus"
              value={form.campus}
              onChange={(e) => onCampusChange(e.target.value)}
              aria-invalid={Boolean(errors.campus)}
              aria-describedby="reg-campus-err"
              className={fieldInput}
            >
              <option value="">Select your campus</option>
              {CAMPUS_CHOICES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <FieldError id="reg-campus-err">{errors.campus}</FieldError>
          </>
        )}

        <label htmlFor="reg-email" className={`${fieldLabel} mt-2`}>Email</label>
        <input
          id="reg-email"
          type="email"
          inputMode="email"
          value={form.email}
          onChange={(e) => set({ email: e.target.value })}
          maxLength={LIMITS.email}
          autoComplete="email"
          placeholder="you@email.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby="reg-email-err"
          className={fieldInput}
        />
        <FieldError id="reg-email-err">{errors.email}</FieldError>

        <label htmlFor="reg-phone" className={`${fieldLabel} mt-2`}>Phone</label>
        <input
          id="reg-phone"
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => set({ phone: e.target.value })}
          maxLength={14}
          autoComplete="tel-national"
          placeholder="10-digit mobile number"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby="reg-phone-err"
          className={fieldInput}
        />
        <FieldError id="reg-phone-err">{errors.phone}</FieldError>

        {showStudentEmail && (
          <>
            <label htmlFor="reg-student-email" className={`${fieldLabel} mt-2`}>Student email (optional)</label>
            <input
              id="reg-student-email"
              type="email"
              inputMode="email"
              value={form.studentEmail}
              onChange={(e) => set({ studentEmail: e.target.value })}
              maxLength={LIMITS.email}
              placeholder="name@poornima.edu"
              aria-invalid={Boolean(errors.studentEmail)}
              aria-describedby="reg-student-email-hint reg-student-email-err"
              className={fieldInput}
            />
            <StudentEmailNote id="reg-student-email-hint" value={form.studentEmail} />
            <FieldError id="reg-student-email-err">{errors.studentEmail}</FieldError>
          </>
        )}

        <button type="submit" className={`${primaryButton} mt-4 w-full`}>
          Continue
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
      </form>
    </RegisterShell>
  )
}
