// Account lists that are configuration, not data.
//   DEMO_EMAILS: the shared demo login. Real workspaces work for it, but every admin endpoint
//                and admin view leaves it out, so admins only ever see real users.
//   ADMIN_EMAILS (env, comma-separated): extra Hub admins on top of the Admins tab, e.g. the founder.
export const DEMO_EMAILS = ['all@example.com']

const lc = (v) => String(v ?? '').trim().toLowerCase()

export const isDemoEmail = (email) => DEMO_EMAILS.includes(lc(email))

export const isEnvAdmin = (email) =>
  Boolean(lc(email)) && String(process.env.ADMIN_EMAILS || '').split(',').map(lc).filter(Boolean).includes(lc(email))

// Drops demo-account rows from any list of rows keyed by email.
export const withoutDemo = (rows) => rows.filter((r) => !isDemoEmail(r.email))

// The demo account's VAC classes live in their own batch, so no real learner (or admin view) sees them.
export const DEMO_VAC_BATCH = 'DEMO'
