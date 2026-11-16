import { createContext, useContext } from 'react'

// The signed-in student's Startup Junction data, loaded once by JunctionDashboard from
// /api/hub/dashboard (profile, invoices, sessions, activity) plus the shared checklist
// (useChecklist), so every view reads the same copy instead of fetching its own.
export const JunctionDataContext = createContext(null)

export function useJunctionData() {
  const ctx = useContext(JunctionDataContext)
  if (!ctx) throw new Error('useJunctionData must be used inside <JunctionDashboard>')
  return ctx
}
