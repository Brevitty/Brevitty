// Small helpers shared by the route modules.
import { fail, sameEmail } from '../rules.js'
import { find } from '../store.js'

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
