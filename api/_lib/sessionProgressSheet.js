// SessionProgress tab reader/writer. Columns (fixed order):
// email | session_id | completed | quiz_score | completed_date
import { getCachedTab, cellToString, isChecked, todayISO, upsertRow } from './sheetsClient.js'
import { getMentorSessions } from './dashboardSheet.js'

const TAB = 'SessionProgress'
const EMAIL_COL = 0
const SESSION_ID_COL = 1
const COMPLETED_COL = 2
const QUIZ_SCORE_COL = 3
const LAST_COL = 'E'

// Session ids come from the cohort's MentorSessions tab.
const validSessionIds = async () => new Set((await getMentorSessions()).map((s) => s.id))
export const isValidSessionId = async (id) => (await validSessionIds()).has(id)

function parseScore(v) {
  const n = Number(cellToString(v))
  return cellToString(v) !== '' && Number.isFinite(n) ? n : null
}

// { session_id: { completed: boolean, quiz_score: number|null } } — ids with no
// row are simply absent; a student with no rows yet gets an empty object, not a 500.
export async function getSessionProgress(email) {
  const [rows, valid] = await Promise.all([getCachedTab(TAB), validSessionIds()])
  const progress = {}
  for (const r of rows.slice(1)) {
    if (cellToString(r[EMAIL_COL]).trim() !== email) continue
    const sessionId = cellToString(r[SESSION_ID_COL]).trim()
    if (valid.has(sessionId)) {
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
