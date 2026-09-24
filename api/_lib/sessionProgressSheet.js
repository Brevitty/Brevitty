// SessionProgress tab reader/writer. Columns (fixed order):
// email | session_id | completed | quiz_score | completed_date
import { getCachedTab, cellToString, isChecked, todayISO, upsertRow } from './sheetsClient.js'
import { SESSIONS } from '../../src/data/mockJunctionDashboard.js'

const TAB = 'SessionProgress'
const EMAIL_COL = 0
const SESSION_ID_COL = 1
const COMPLETED_COL = 2
const QUIZ_SCORE_COL = 3
const LAST_COL = 'E'

export const VALID_SESSION_IDS = new Set(SESSIONS.map((s) => s.id))

function parseScore(v) {
  const n = Number(cellToString(v))
  return cellToString(v) !== '' && Number.isFinite(n) ? n : null
}

// { session_id: { completed: boolean, quiz_score: number|null } } — ids with no
// row are simply absent; a student with no rows yet gets an empty object, not a 500.
export async function getSessionProgress(email) {
  const rows = (await getCachedTab(TAB)).slice(1)
  const progress = {}
  for (const r of rows) {
    if (cellToString(r[EMAIL_COL]).trim() !== email) continue
    const sessionId = cellToString(r[SESSION_ID_COL]).trim()
    if (VALID_SESSION_IDS.has(sessionId)) {
      progress[sessionId] = { completed: isChecked(r[COMPLETED_COL]), quiz_score: parseScore(r[QUIZ_SCORE_COL]) }
    }
  }
  return progress
}

export async function setSessionProgress(email, sessionId, completed, quizScore) {
  await upsertRow(
    TAB,
    [EMAIL_COL, SESSION_ID_COL],
    [email, sessionId],
    () => [email, sessionId, completed ? 'TRUE' : 'FALSE', quizScore ?? '', todayISO()],
    LAST_COL
  )
}
