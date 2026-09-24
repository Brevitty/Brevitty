// GET/POST /api/checklist — the signed-in student's "My Startup" checklist.
import { allowMethod, readJson } from './_lib/http.js'
import { requireSession } from './_lib/session.js'
import { getChecklist, setChecklistItem, VALID_ITEM_IDS } from './_lib/checklistSheet.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }
  res.setHeader('Cache-Control', 'no-store')

  const session = await requireSession(req, res)
  if (!session) return

  if (req.method === 'GET') {
    try {
      return res.status(200).json({ checklist: await getChecklist(session.email) })
    } catch (err) {
      console.error(`[checklist] ${err.message}`)
      return res.status(503).json({ error: 'Checklist is temporarily unavailable. Please try again in a few minutes.' })
    }
  }

  const body = readJson(req)
  const itemId = typeof body?.item_id === 'string' ? body.item_id : ''
  const checked = body?.checked
  if (!VALID_ITEM_IDS.has(itemId) || typeof checked !== 'boolean') {
    return res.status(400).json({ error: 'Invalid item_id or checked value.' })
  }

  try {
    await setChecklistItem(session.email, itemId, checked)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(`[checklist] ${err.message}`)
    return res.status(503).json({ error: 'Could not save your checklist change. Please try again.' })
  }
}
