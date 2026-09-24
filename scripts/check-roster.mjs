// Usage: node scripts/check-roster.mjs [email]
// Loads .env.local, reads the roster through api/_lib/roster.js and prints:
//   - how many students were found, with membership counts (counts only)
//   - found / not found for [email] (exact, case-sensitive). Never prints passwords.
// Google/HTTP failures are logged by roster.js with the HTTP status and Google's message.

import { loadEnv } from 'vite'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

// Same loader the dev server uses. Values go straight into process.env; nothing is printed.
for (const [k, v] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (process.env[k] === undefined) process.env[k] = v
}

const { findStudent, summarizeRoster } = await import(
  pathToFileURL(path.resolve('api/_lib/roster.js')).href
)

const email = process.argv[2]
try {
  const sum = await summarizeRoster()
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'
  console.log(`Students found: ${sum.students}`)
  console.log(`  without memberships: ${sum.withoutMemberships}`)
  console.log(`  memberships by status: ${fmt(sum.byStatus)}`)
  console.log(`  memberships by pillar: ${fmt(sum.byPillar)}`)
  if (email !== undefined) {
    const student = await findStudent(email)
    console.log(`Email "${email}": ${student ? 'FOUND' : 'NOT FOUND'} (exact, case-sensitive match)`)
  }
} catch (err) {
  // roster.js has already logged the underlying Google/HTTP error above this line.
  console.error(`Roster check failed: ${err.message}`)
  process.exitCode = 1
}
