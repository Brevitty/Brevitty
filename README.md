# Brevitty

`npm run dev` / `npm run build`. Server routes live in `api/` (Vercel functions); the Hub API is `api/hub.js`.

## Incubation data (`/hub/incubation`)

Google Sheets is the only database; Supabase Storage holds uploaded files only (the sheet keeps `file_name` + `file_path`).
Every row is keyed by the signed-in startup's `email`; the server filters on the session email, never on client input.
Tabs are created by `node --env-file=.env.local scripts/setup-hub-pillars-tabs.mjs` (idempotent). API: `{ok, data}` / `{ok:false, error}`.

| Tab | Columns |
|---|---|
| `INC_Startups` (profile) | email, startup, founder_name, sector, stage, website, updated_at |
| `INC_KPIs` | email, quarter, revenue, runway_months, jobs_created, updated_at |
| `INC_Funding` | email, id, funder, type, amount, date, status, notes, file_name, file_path, created_at |
| `INC_Documents` (MoU + other docs) | email, id, kind, title, file_name, file_path, status, uploaded_at, renewal_date |
| `INC_SchemeList` (team-curated, shared) | id, name, authority, description, eligibility, max_benefit, deadline, apply_url, active |
| `INC_SchemeStatus` | email, scheme_id, status, updated_at |

MoU `renewal_date` = upload date + 3 years, computed server-side on save.
Env for uploads: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (see `.env.example`).
