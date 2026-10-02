// Attendance tab: email | session_id | date | status   (one row per student per session;
// status "present" counts as attended, anything else as absent). Matches the header that
// scripts/setup-startup-junction-tabs.mjs writes. Held = the cohort session's date has passed.
import { getCachedTab, rowsToObjects, cellToString } from './sheetsClient.js'
import { getMentorSessions } from './dashboardSheet.js'

const PRESENT = 'present'

export async function getAttendanceSummary(email) {
  const [rows, cohortSessions] = await Promise.all([getCachedTab('Attendance'), getMentorSessions()])
  const presentIds = new Set(
    rowsToObjects(rows)
      .filter((r) => cellToString(r.email).trim() === email && cellToString(r.status).trim().toLowerCase() === PRESENT)
      .map((r) => cellToString(r.session_id).trim())
  )
  const sessions = cohortSessions.map((s) => {
    const held = s.status === 'past'
    return { session_id: s.id, held, present: held ? presentIds.has(s.id) : null }
  })
  const held = sessions.filter((s) => s.held)
  return { sessions, held_count: held.length, present_count: held.filter((s) => s.present).length }
}
