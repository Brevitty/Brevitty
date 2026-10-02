import { allowMethod } from './_lib/http.js'
import { signOutEverywhere } from './_lib/signIn.js'

export default async function handler(req, res) {
  if (!allowMethod(req, res, 'POST')) return
  signOutEverywhere(req, res)
  return res.status(200).json({ ok: true })
}
