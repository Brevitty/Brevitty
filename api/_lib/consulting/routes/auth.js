// login / me / logout for /consulting. Login and logout are the shared Hub ones
// (_lib/signIn.js), so signing in here also opens every other workspace the account has.
import { readFieldsOr401 } from './shared.js'
import { clientIp, makeRateLimiter } from '../../http.js'
import { signIn, signOutEverywhere, GENERIC_ERROR } from '../../signIn.js'
import { fail } from '../rules.js'
import { pub } from '../store.js'

const MAX_EMAIL_CHARS = 254
const MAX_PASSWORD_CHARS = 256
const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 60_000

// Best effort, resets on cold start (same as api/login.js).
const limited = makeRateLimiter(LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)

const profileOf = (account) => ({ role: account.role, ...pub(account) })

export default {
  'POST login': {
    auth: 'none',
    fn: async ({ req, res, body }) => {
      if (limited(clientIp(req))) fail(429, 'Too many attempts. Give it a minute and try again.')
      const { email, password } = readFieldsOr401(body, ['email', 'password'], GENERIC_ERROR, {
        email: MAX_EMAIL_CHARS,
        password: MAX_PASSWORD_CHARS,
      })
      const { account } = await signIn(req, res, email, password)
      // Right password, but only a Startup Junction account: signed in there, nothing to open here.
      if (!account) fail(403, 'This account has no Consulting workspace. Open My workspace to see the ones it has.')
      return { ok: true, ...profileOf(account) }
    },
  },
  'GET me': { auth: 'any', fn: async ({ account }) => profileOf(account) },
  'POST logout': {
    auth: 'none',
    fn: async ({ req, res }) => {
      signOutEverywhere(req, res)
      return { ok: true }
    },
  },
}
