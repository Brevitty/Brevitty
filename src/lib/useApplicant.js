import { useCallback, useEffect, useState } from 'react'
import { loadApplicant, saveApplicant, withoutStaleDepartment } from './registration.js'

// Applicant form state, prefilled from this tab's last entry and saved back as it changes, so a student
// registering for a second option doesn't retype their details. `initial` wins over what was saved
// (the eligibility gate uses it to preselect the campus).
export function useApplicant(initial = {}) {
  const [applicant, setApplicant] = useState(() => withoutStaleDepartment({ ...loadApplicant(), ...initial }))
  useEffect(() => saveApplicant(applicant), [applicant])
  const patch = useCallback((changes) => setApplicant((a) => ({ ...a, ...changes })), [])
  return [applicant, patch]
}
