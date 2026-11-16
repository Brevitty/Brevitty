// The applicant block reused on every registration page: Name, Email, Phone, college student?, campus and, for
// the four campuses, student email + department + course + semester.
// `gated` (Startup Junction / Arena): the eligibility gate already confirmed a student at one of the four campuses,
// so there is no Yes/No question and no "Others".
import { fieldLabel, fieldInput, StudentEmailNote } from './RegisterShell.jsx'
import { Field } from './FormParts.jsx'
import { VERIFIED_CAMPUSES, OTHER_CAMPUS, LIMITS } from '../../data/registrationOptions.js'
import { isStudentCampus } from '../../lib/registration.js'

// Yes / No pill pair (radio semantics). Also used by the eligibility gate.
export function YesNo({ label, value, onChange, invalid }) {
  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} className="mt-1.5 flex gap-3">
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

const CLEARED_STUDENT_FIELDS = { campus: '', studentEmail: '', department: '', course: '', semester: '' }

export default function ApplicantFields({ value, onChange, errors = {}, gated = false }) {
  const student = gated || value.collegeStudent === 'Yes'
  const verified = student && isStudentCampus(value.campus)
  const campusChoices = gated ? VERIFIED_CAMPUSES : [...VERIFIED_CAMPUSES, OTHER_CAMPUS]

  // Leaving the four campuses (or answering No) drops the student-only answers so none are sent by accident.
  const changeStudent = (answer) => onChange({ collegeStudent: answer, ...(answer === 'No' ? CLEARED_STUDENT_FIELDS : {}) })
  const changeCampus = (campus) =>
    onChange({ campus, ...(isStudentCampus(campus) ? {} : { studentEmail: '', department: '', course: '', semester: '' }) })

  return (
    <fieldset className="border-0 p-0">
      <legend className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]">About you</legend>

      <Field id="ap-name" label="Name" error={errors.name}>
        <input id="ap-name" value={value.name} maxLength={LIMITS.name} autoComplete="name" placeholder="Your full name"
          onChange={(e) => onChange({ name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby="ap-name-err" className={fieldInput} />
      </Field>
      <Field id="ap-email" label="Email" error={errors.email}>
        <input id="ap-email" type="email" inputMode="email" value={value.email} maxLength={LIMITS.email} autoComplete="email" placeholder="you@email.com"
          onChange={(e) => onChange({ email: e.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby="ap-email-err" className={fieldInput} />
      </Field>
      <Field id="ap-phone" label="Phone" error={errors.phone}>
        <input id="ap-phone" type="tel" inputMode="numeric" value={value.phone} maxLength={14} autoComplete="tel-national" placeholder="10-digit mobile number"
          onChange={(e) => onChange({ phone: e.target.value })} aria-invalid={Boolean(errors.phone)} aria-describedby="ap-phone-err" className={fieldInput} />
      </Field>

      {!gated && (
        <div>
          <span className={`${fieldLabel} mt-2`}>Are you a college student?</span>
          <YesNo label="Are you a college student?" value={value.collegeStudent} onChange={changeStudent} invalid={Boolean(errors.collegeStudent)} />
          <p role="alert" className="mt-1 min-h-[1.25rem] text-xs font-medium text-red-600">{errors.collegeStudent}</p>
        </div>
      )}

      {gated && (
        // Already picked on the previous screen and not editable here (go back to options to start over).
        <Field id="ap-campus" label="Campus" error={errors.campus}>
          <input id="ap-campus" value={value.campus} readOnly aria-readonly="true" className={`${fieldInput} cursor-default bg-black/[0.04] font-semibold`} />
        </Field>
      )}

      {student && !gated && (
        <Field id="ap-campus" label="Campus" error={errors.campus}>
          <select id="ap-campus" value={value.campus} onChange={(e) => changeCampus(e.target.value)} aria-invalid={Boolean(errors.campus)} aria-describedby="ap-campus-err" className={fieldInput}>
            <option value="">Select your campus</option>
            {campusChoices.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      )}

      {verified && (
        <>
          <Field id="ap-studentEmail" label="Student email" error={errors.studentEmail}>
            <input id="ap-studentEmail" type="email" inputMode="email" value={value.studentEmail} maxLength={LIMITS.email} placeholder="name@poornima.edu"
              onChange={(e) => onChange({ studentEmail: e.target.value })} aria-invalid={Boolean(errors.studentEmail)} aria-describedby="ap-studentEmail-hint ap-studentEmail-err" className={fieldInput} />
            <StudentEmailNote id="ap-studentEmail-hint" value={value.studentEmail} />
          </Field>
          <Field id="ap-department" label="Department" error={errors.department}>
            <input id="ap-department" value={value.department} maxLength={LIMITS.field} placeholder="e.g. Computer Science"
              onChange={(e) => onChange({ department: e.target.value })} aria-invalid={Boolean(errors.department)} aria-describedby="ap-department-err" className={fieldInput} />
          </Field>
          <Field id="ap-course" label="Course" error={errors.course}>
            <input id="ap-course" value={value.course} maxLength={LIMITS.field} placeholder="e.g. B.Tech"
              onChange={(e) => onChange({ course: e.target.value })} aria-invalid={Boolean(errors.course)} aria-describedby="ap-course-err" className={fieldInput} />
          </Field>
          <Field id="ap-semester" label="Semester" error={errors.semester}>
            <input id="ap-semester" inputMode="numeric" value={value.semester} maxLength={LIMITS.semester} placeholder="e.g. 5"
              onChange={(e) => onChange({ semester: e.target.value })} aria-invalid={Boolean(errors.semester)} aria-describedby="ap-semester-err" className={fieldInput} />
          </Field>
        </>
      )}
    </fieldset>
  )
}
