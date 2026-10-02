import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only bridge: the Vite dev server (port 5173) does NOT run the Vercel
// serverless functions in /api. This plugin routes /api/<name> to api/<name>.js
// as Connect middleware during `npm run dev`, adapting Vercel's (req,res)
// handler to Node's raw req/res (body parsing, res.status/res.json; the Cookie
// request header and Set-Cookie response header are plain Node and pass through).
// Does nothing in the build. Handler edits need a dev-server restart (Node caches imports).
const DISPATCHER_PREFIXES = new Set(['consulting', 'hub'])

function devApi() {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      // Load .env / .env.local into process.env so handlers can read
      // GEMINI_API_KEY / SESSION_SECRET (Vite doesn't expose non-VITE_ vars).
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v
      }

      server.middlewares.use('/api', async (req, res, next) => {
        const send = (code, obj) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }
        try {
          // /login?x=1 -> "login", /hub/workspace -> "hub/workspace". Segments are [a-z-] only, so no path traversal.
          const name = (req.url || '').split('?')[0].replace(/^\/+|\/+$/g, '')
          if (!/^[a-z][a-z-]*(\/[a-z][a-z-]*)*$/.test(name)) return next()
          // A few features (consulting, hub) are one function that dispatches its own sub-routes
          // (Vercel Hobby's 12-function cap): /api/consulting/login -> api/consulting.js
          const prefix = name.split('/')[0]
          const exact = path.resolve(process.cwd(), 'api', `${name}.js`)
          const file = !fs.existsSync(exact) && DISPATCHER_PREFIXES.has(prefix) ? path.resolve(process.cwd(), 'api', `${prefix}.js`) : exact
          if (!fs.existsSync(file)) return send(404, { error: 'Not found.' })

          // collect the raw request body; hand handlers parsed JSON, or the raw
          // string if it isn't valid JSON (handlers answer 400 themselves)
          const chunks = []
          for await (const c of req) chunks.push(c)
          const raw = Buffer.concat(chunks).toString('utf8')
          try {
            req.body = raw ? JSON.parse(raw) : {}
          } catch {
            req.body = raw
          }

          // adapt Node res -> the subset of the Vercel res API the handlers use
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
            return res
          }

          const { default: handler } = await import(pathToFileURL(file).href)
          await handler(req, res)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[dev-api] error', err)
          if (!res.headersSent) send(500, { error: 'Dev API error. See terminal.' })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
})
