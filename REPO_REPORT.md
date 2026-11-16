# REPO_REPORT — Brevitty (audit for Startup Junction sign-in feature)

Audit date: 2026-09-21. Read-only audit; no code was modified. Branch `main`, 4 commits, clean tree, 97 tracked files. `node_modules` is not installed, so nothing was built or run. Runtime behaviour is unverified.

**Headline finding:** a login gate for the toolkit already exists, but it is a client-side demo (hardcoded credentials + `sessionStorage` flag). The feature is a replacement of that gate, not a new build. `/api/generate` is currently unauthenticated.

---

## 1. Stack and setup

| Item | Finding |
|---|---|
| Framework | React 18.3 + Vite 6 SPA (not Next.js) |
| Router | `react-router-dom` ^6.30 with `BrowserRouter` (`src/main.jsx`), declarative `<Routes>` in `src/App.jsx` |
| Language | JavaScript (`.jsx`/`.js`). No TypeScript, no `tsconfig` |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite`. Theme tokens in `src/index.css` `@theme` block. No `tailwind.config.js`. A few custom CSS classes in the same file |
| UI libs | `framer-motion` ^11.18 for animation. No component library (no shadcn/MUI). Fonts from Google Fonts in `index.html`: Inter, Space Grotesk, JetBrains Mono, Caveat |
| Package manager | npm (`package-lock.json`) |
| Scripts | `dev` (vite), `build` (vite build), `preview`. No lint, test or typecheck scripts |
| Deps | Runtime: `framer-motion`, `react`, `react-dom`, `react-router-dom`. Dev: `@tailwindcss/vite`, `@vitejs/plugin-react`, `tailwindcss`, `vite`. All use `^` ranges (not pinned) |
| Env vars | Only `GEMINI_API_KEY` (server-only, read in `api/generate.js`). `.env.example` documents it. `.env`, `.env.local` are gitignored. No `VITE_*` vars |
| Deployment | Vercel. `vercel.json` has one rewrite: `/((?!api/).*)` → `/index.html` (SPA fallback, `/api/*` excluded). No `functions`, `headers`, `crons` or build config |
| Serverless | `api/generate.js` (Node runtime, default export `(req, res)`). `package.json` has `"type": "module"`, so the API is ESM |
| Dev API bridge | `vite.config.js` plugin `devApi()` mounts only `/api/generate` as Connect middleware in `npm run dev`. A new API route will **not** work locally unless it is added here (or you use `vercel dev`) |

## 2. Structure

```
Brevitty/
├─ api/
│  ├─ generate.js            # only serverless function
│  └─ _lib/
│     ├─ prompts.js          # loads skill .md files via fs at module load
│     └─ skills/*.md         # 6 system prompts (server-side)
├─ Skills/*.skill            # 6 source skill files (sources for the .md copies)
├─ public/                   # logos, mentor/startup images
├─ src/
│  ├─ main.jsx, App.jsx, index.css
│  ├─ pages/                 # 12 route pages
│  ├─ components/            # site-wide sections + events/, junction/, partners/
│  └─ data/                  # hardcoded content modules + store.js
├─ index.html, vite.config.js, vercel.json, package.json, .env.example
```

### Routes (all in `src/App.jsx`)

| Path | Page file | Description |
|---|---|---|
| `/` | `HomePage.jsx` | Landing: composes Hero, marquees, founder journey, startups, mentors, testimonials, apply CTA |
| `/about` | `AboutPage.jsx` | About Brevitty |
| `/community` | `CommunityPage.jsx` | "Our Startups" directory |
| `/events` | `EventsPage.jsx` | Events list |
| `/events/:slug` | `EventDetailPage.jsx` | Event detail, registration modal, countdown |
| `/mentors` | `MentorsPage.jsx` | Mentor list |
| `/mentors/:slug` | `MentorProfilePage.jsx` | Mentor profile |
| `/partners` | `PartnersPage.jsx` | Partners |
| `/grants` | `GrantsPage.jsx` | Grants |
| `/space` | `SpacePage.jsx` | Space page. Not linked from the navbar (unverified whether linked elsewhere) |
| `/startup-junction` | `StartupJunctionPage.jsx` | Startup Junction 2026 landing + AI toolkit (auth-gated, see §3) |
| `/admin` | `AdminPage.jsx` | Admin content editor. Navbar and footer hidden. Hardcoded login |

No 404 route (unknown paths render a blank layout with navbar and footer).

## 3. Startup Junction page

**Files:** `src/pages/StartupJunctionPage.jsx` (411 lines; all section components are defined in this one file), `src/components/junction/JunctionAuthGate.jsx`, `ToolDetailView.jsx`, `JunctionMarkdown.jsx`, data in `src/data/junctionTools.js`.

**Entry point:** linked from `src/components/Hero.jsx:96` as a "Startup Junction 2026 →" button. It is **not** in `Navbar.jsx`'s `NAV_LINKS`.

**Page flow (`StartupJunctionPage` default export, line 374):**
1. `authed` state initialised from `sessionStorage.getItem('sj_authed') === '1'`.
2. If not authed → renders **only** `<JunctionAuthGate>`. This means the **entire page** (hero, problem, toolkit, everything) is currently gated, not just `#toolkit`.
3. If authed → `AnimatePresence` toggles between `<ToolDetailView>` (when a tool is selected) and the landing.

**Landing sections, in order:**
1. `Hero` — "Startup Junction 2026", CTAs to `#toolkit` and `#how`
2. `StageMarquee` — scrolling stage names (hardcoded `STAGES`)
3. `ProblemSection` — 4 cards (hardcoded `PROBLEMS`)
4. `Toolkit` (`id="toolkit"`, line 247) — heading "Six advisors. One founder's journey." + grid of `ToolCard`s
5. `HowItWorks` (`id="how"`) — 3 steps (hardcoded `STEPS`)
6. `CtaBand` — dark band, "Open the toolkit" → `#toolkit`

**`#toolkit` content:** Hardcoded. `TOOLS` from `src/data/junctionTools.js` (6 tools: idea-validator, competitor-analysis, gtm-generator, mvp-blueprint, deck-builder, financial-model-builder), each with id, num, name, tagline, kind, chips, tips, example. Rendered by `Toolkit` → `ToolCard` in the page file. Clicking a card sets `tool` state (no URL change, no sub-route) and shows `ToolDetailView`.

**Data fetching:** `ToolDetailView.jsx:25` does `fetch('/api/generate', { method:'POST', body:{toolId,input} })` and renders the returned markdown via `JunctionMarkdown`. No credentials, token or cookie logic.

**Navbar/header:** `src/components/Navbar.jsx`. Fixed top header (`h-16`, `bg-white/80 backdrop-blur`), with an India-time ticker on the left and 7 text links on the right (HOME, ABOUT, OUR STARTUPS, EVENTS, MENTORS, PARTNERS, GRANTS). The mobile menu is a full-screen overlay with an "Apply Now →" button and social icons. **No sign-in/sign-out/account UI in the navbar.** Rendered by `App.jsx` on every route except `/admin`.

**Existing auth UI:** `JunctionAuthGate.jsx` (see §4).

## 4. Auth and data

**Existing auth (both fake, client-side only):**

| Where | Mechanism |
|---|---|
| `src/components/junction/JunctionAuthGate.jsx:9-10` | `DEMO_EMAIL='<demo-email>'`, `DEMO_PASSWORD='<demo-password>'` compared in the browser; on match sets `sessionStorage.sj_authed='1'` |
| `src/pages/AdminPage.jsx:16-17` | `ADMIN_EMAIL` / `ADMIN_PASSWORD` hardcoded in source (real-looking address and password). Same `sessionStorage` flag pattern (`brevitty_admin_authed`) |

Anyone can bypass either gate with `sessionStorage.setItem('sj_authed','1')` in devtools, and credentials are visible in the shipped JS bundle.

**Sessions / cookies / middleware:** none. No `middleware.js`, no `Set-Cookie`, no JWT, no auth library.

**API routes:** one, `api/generate.js`.
- POST only; per-IP in-memory rate limit (6 req / 60 s, resets on cold start, `x-forwarded-for` based).
- Validates `toolId` against `TOOL_PROMPTS` and `input` (≤ 4000 chars).
- Calls Gemini 2.5 Flash (`generativelanguage.googleapis.com`) with `x-goog-api-key` from `process.env.GEMINI_API_KEY`.
- **No authentication.** Anyone who knows the URL can call it directly and spend the Gemini quota. The file's own header comment acknowledges this.
- `api/_lib/prompts.js` imports from `../../src/data/junctionTools.js` (server importing client data) and reads `skills/*.md` with `fs` at load.

**Google Sheets / Google APIs:** none. Only Google usage is Gemini in `generate.js`, plus Google Fonts and a Google Form link (`https://forms.gle/JhuGFUnYRthAJFyc9`) used for "Apply Now" in several components. No `googleapis` package, no service account, no `GOOGLE_*` env vars.

**Database / third-party services:** none (no Supabase, Firebase, etc.). Content is hardcoded in `src/data/*.js`. `src/data/store.js` layers admin edits over defaults via **`localStorage`** (per-browser only, not shared).

**Other network calls:** only `/api/generate`. `RegistrationModal.jsx` has no `fetch` (unverified what it does on submit; no network call found).

## 5. Design system

- **Theme:** light only (`color-scheme: light`, white body, no `dark:` variants). Some sections use dark bands (`bg-[#08070a]`, e.g. `CtaBand`) as accents.
- **Responsive:** yes, Tailwind breakpoints (`sm/md/lg`), mobile menu overlay, grid collapses. Max content width `max-w-7xl`, gutters `px-6 lg:px-10`.
- **Tokens (`src/index.css`):** `orange #f97316` (`bg-orange`, `text-orange`), `orange-soft #fb923c`, `ink #0a0a0a`. Frequent literal `#fafaf8` for alternating section backgrounds. Fonts: `font-sans` Inter, `font-display` Space Grotesk (headings), `font-mono` JetBrains Mono (labels/eyebrows), `font-hand` Caveat.
- **Patterns to match (all inline Tailwind, no shared component files):**
  - Eyebrow: `font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange`
  - H1/H2: `font-display font-bold tracking-tight text-ink`
  - Body: `text-sm text-black/55`
  - Primary button: `rounded-full bg-orange px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(249,115,22,0.6)]`
  - Secondary button: `rounded-full border border-black/15 bg-white/60 px-7 py-3.5 text-sm font-semibold text-ink backdrop-blur-sm`
  - Card: `rounded-2xl border border-black/10 bg-white p-6/p-7`, hover `border-orange/60`
  - Input: `w-full rounded-xl border border-black/15 bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-orange`
  - Field label: `font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45`
  - Error text: `text-sm font-medium text-red-500`
  - Shared easing `ease = [0.22,1,0.36,1]`, duplicated per file
- **Reusable for a sign-in form:** `JunctionAuthGate.jsx` already is the sign-in form styled to match (card `rounded-3xl`, orange radial glow, shake-on-error via `motion.form`, `autoComplete` set). The easiest path is to keep its markup and swap the submit logic. `AdminPage.jsx` has a near-identical login form (lines ~170–230). There is no shared `Button`/`Input` component; both forms duplicate the classes.

## 6. Gaps and risks

**Conflicts / things to handle when adding a serverless login + session cookie**
1. **`/api/generate` is open.** A cookie set at login does nothing unless `generate.js` also verifies it. Gating only the UI leaves the paid Gemini endpoint public.
2. **Same-origin only is fine for cookies**, but local dev needs the `vite.config.js` `devApi()` bridge extended (it hardcodes `/api/generate`; it does not set cookies via `res.setHeader`-safe helpers beyond `status`/`json`). Adding `/api/login` etc. means duplicating the bridge or switching dev to `vercel dev`.
3. **No cookie/body parsing helpers.** The dev bridge parses JSON only. No `cookie` lib installed (Vercel's Node runtime does not auto-parse `req.cookies` in the dev bridge; unverified on Vercel).
4. **Auth state is a boolean in `sessionStorage`.** A cookie-based session needs a "who am I" check (e.g. `GET /api/me`) on page load, and the page needs a loading state. Currently `useState` reads storage synchronously, so there is no flash-of-gate handling.
5. **Whole page is gated, not just `#toolkit`.** If the intent is a public Startup Junction landing with only the toolkit locked, `StartupJunctionPage` must be restructured (the gate currently `return`s before rendering Hero, etc.).
6. **Sign-in "only" page:** no existing `/signin` route. The tool view is state-driven, not URL-driven, so redirect-after-login and deep links to a tool are not supported.
7. **Google Sheet access:** no Google credentials, no `googleapis`. Needs a service account (or API key for a public sheet), new env vars, and a server-only fetch. Vercel env vars for these do not exist yet.
8. **Serverless statelessness:** the in-memory rate limiter resets on cold start. Login brute-force protection will need a durable store or a Sheet-based lockout (unverified fit).
9. **Vercel bundling of `prompts.js`:** it reads `skills/*.md` with `fs` from `__dirname` and imports from `../../src/`. Whether Vercel traces these files into the function bundle is unverified (no `includeFiles` in `vercel.json`).
10. **SPA rewrite** excludes `/api/` only, so new routes under `/api/` are safe.

**Secrets / dead code / TODOs**
- **Hardcoded credentials in source:** `AdminPage.jsx:16-17` (email + password `Brevitty@3214`), `JunctionAuthGate.jsx:9-10`. Both are shipped in the client bundle. The admin credentials are committed to git history. Treat as exposed and rotate.
- No real API keys found in the repo (`.env` is not tracked; `.env.example` is empty). A grep for `AIza` and `sk-` patterns found no hits.
- **Stale copy in the gate:** error text says "Use the demo login below" but no demo credentials are displayed; the subtitle says "nine AI advisory tools" while `TOOLS` has 6 (and the Toolkit heading says "Six").
- **Duplication:** `Skills/*.skill` and `api/_lib/skills/*.md` are copies (prompts.js comment says "synced from Skills/"); there is no sync script (unverified whether contents are identical).
- `SKILL_TOOL_IDS`, `TOOL_IDS`, `getTool` in `junctionTools.js` are partly unused on the client (unverified).
- No tests, no lint config, no CI config, no README. Dependency ranges are not pinned.
- Admin edits use `localStorage`, so they are invisible to other visitors (by design, per `store.js`).
- No TODO/FIXME comments found in `src/` or `api/`.

---

## Where to plug in the sign-in feature

**Touch (existing):**
- `src/pages/StartupJunctionPage.jsx:374-411` — replace the `sessionStorage` `authed` state with a session check (call `/api/me`, show loading, then gate). If only `#toolkit` should be locked, move the gate from the top-level `return` to inside `Toolkit`/the tool view instead.
- `src/components/junction/JunctionAuthGate.jsx` — keep the styling; delete the hardcoded creds and `sessionStorage.setItem`; `fetch('/api/login', { method:'POST', credentials:'same-origin', … })` and call `onAuthed()` on 200. Fix the stale copy while there.
- `src/components/junction/ToolDetailView.jsx:25` — handle `401` from `/api/generate` by sending the user back to sign-in.
- `api/generate.js` (top of `handler`, before the rate limit/Gemini call) — verify the session cookie; return 401 if missing/invalid. This is the real lock on the toolkit.
- `vite.config.js` — generalise `devApi()` to mount `/api/login`, `/api/me`, `/api/logout` (or run `vercel dev`), and allow `Set-Cookie` on the adapted `res`.
- `.env.example` — add the new vars (e.g. Sheet ID, Google service-account email/key, session-signing secret).
- `src/components/Navbar.jsx` (optional) — add a sign-in/sign-out link if desired; `NAV_LINKS` at the top is the place.
- `src/App.jsx` — only if you add a dedicated `/startup-junction/signin` route.

**Add (new):**
- `api/login.js` — POST email (+ code/password) → look up the row in the Google Sheet → set `HttpOnly; Secure; SameSite=Lax; Path=/` signed cookie.
- `api/me.js` — GET → returns the session identity or 401.
- `api/logout.js` — clears the cookie.
- `api/_lib/session.js` — sign/verify cookie (Node `crypto` HMAC is enough; no new dep needed) and a `requireSession(req, res)` helper reused by `generate.js`.
- `api/_lib/sheets.js` — server-only Google Sheets read (REST via `fetch` + service-account JWT, or `googleapis`). Cache the roster briefly to avoid a Sheet call per request.
- Optional: `src/pages/SignInPage.jsx` (only if a standalone sign-in page is wanted; otherwise reuse `JunctionAuthGate`).

**Also do:** remove or rotate the admin credentials in `AdminPage.jsx` (out of scope for this feature, but exposed in git history).
