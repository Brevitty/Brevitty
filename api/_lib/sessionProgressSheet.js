// SessionProgress tab reader/writer, by header name:
// email | session_id | completed | quiz_score | completed_date
import { todayISO, isChecked } from './sheetsClient.js'
import { rowsFor, upsert } from './pillarStore.js'
import { getCohortSessions, warmStartup } from './dashboardSheet.js'

const TAB = 'SessionProgress'

// Session ids come from the cohort sessions tab.
const validSessionIds = async () => new Set((await getCohortSessions('', true)).map((s) => s.id))
export const isValidSessionId = async (id) => (await validSessionIds()).has(id)

function parseScore(v) {
  const n = Number(v)
  return v !== '' && Number.isFinite(n) ? n : null
}

// { session_id: { completed: boolean, quiz_score: number|null } } — ids with no
// row are simply absent; a student with no rows yet gets an empty object, not a 500.
export async function getSessionProgress(email) {
  await warmStartup()
  const [rows, valid] = await Promise.all([rowsFor(TAB, email), validSessionIds()])
  return Object.fromEntries(
    rows.filter((r) => valid.has(r.session_id)).map((r) => [r.session_id, { completed: isChecked(r.completed), quiz_score: parseScore(r.quiz_score) }])
  )
}

export async function setSessionProgress(email, sessionId, completed, quizScore) {
  await upsert(TAB, { email, session_id: sessionId }, { completed: completed ? 'TRUE' : 'FALSE', quiz_score: quizScore ?? '', completed_date: todayISO() })
}
