// Small helpers shared by the route modules.
import { fail, sameEmail } from '../rules.js'
import { find, list } from '../store.js'
import { isDemoEmail, withoutDemo } from '../../accounts.js'

// Pulls string fields out of a login-style body; any missing/oversized field is a 401 with `message`.
export function readFieldsOr401(body, keys, message, maxByKey) {
  const out = {}
  for (const k of keys) {
    const v = typeof body?.[k] === 'string' ? body[k] : ''
    if (!v.trim() || v.length > maxByKey[k]) fail(401, message)
    out[k] = k === 'password' ? v : v.trim()
  }
  return out
}

// Row by id, or 404 (also 404 when it isn't `email`'s, so ids of other people's rows can't be probed).
export async function findOr404(tab, id, label, { ownedBy } = {}) {
  const row = await find(tab, id)
  if (!row || (ownedBy && !sameEmail(row.email, ownedBy))) fail(404, `${label} not found.`)
  return row
}

// Admin reads never include the demo account (accounts.js): its rows are skipped in lists and a
// direct id reads as 404, so the admin screens only ever show real students.
export const listReal = async (tab, opts) => withoutDemo(await list(tab, opts))
export async function findRealOr404(tab, id, label) {
  const row = await findOr404(tab, id, label)
  if (isDemoEmail(row.email)) fail(404, `${label} not found.`)
  return row
}
