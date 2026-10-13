# Decisions log

Non-trivial calls made while building Launchpad Abroad, Incubation and VAC Learner (2026-10-02, autopilot).

## Pillars
- **"Mentorship & Profile Building" removed from `hubPillars.js`**: it is the same pillar as Launchpad Abroad, renamed. A roster cell still saying `mentorship:approved` is ignored by the roster parser (a warning, not an error).
- **Incubation and VAC Learner lost `comingSoon`**: they open real dashboards. Hub Admin stays coming soon.
- **One shell for the new workspaces** (`src/components/hub/PillarDashboard.jsx`):
  - It reuses `DashboardSidebar` / `DashboardMobileNav` / `ChangePasswordModal`, the same dark-mode storage key and the same keyed view swap as `JunctionDashboard`.
  - `JunctionDashboard` was not refactored. Its only changes are the shared-component imports and the `backTo` prop.
- **`DashboardSidebar` got optional props** (`workspaceLabel`, `cardSubtitle`, `milestoneNoun`, `backTo`). The defaults are the old Startup Junction copy. The mobile nav's scroll-hint fade is now dark-aware; it was a white block in dark mode.

## Data / API
- **All new routes live in `api/hub.js`** (single function), because the project is at Vercel Hobby's 12-function cap.
- **Writes are always keyed by the session email.** Workspace routes also need an approved membership for that pillar. Mentor routes need the session email to be a `contact_email` in `LP_Mentors`.
- **Extra columns/tabs beyond the brief:**
  - `LP_Students.mentor_id`: who the assigned mentor is.
  - `LP_Feedback` (`email, mentor_id, date, feedback`): mentor feedback had no tab.
  - `INC_Compliance.note`: holds "Renewal" / "Read-only" etc.
  - `INC_Startups.exit_review` and `transition_plan`: the Exit Status view needs them.
  - `INC_Resources.link`, `VAC_Content.link`: optional.
  - `VAC_Feedback.submitted_date`.
- **Uploads are link-only** (Drive/Docs/any https URL), for Launchpad documents, Incubation documents, VAC assignments and Partner reports. Real file upload is not wired.
- **Launchpad checklist ticks in a locked phase are refused server-side (409).** The phase is computed from ticks only. Profile Ready = all 4 phases done AND an `LP_Signoff` row, which only a mentor can write and only once Phase 4 is complete.
- **Incubation "Next actions"** come from upcoming `INC_Compliance` review dates, plus "Quarterly KPI update" when the current quarter has no KPI rows yet. A KPI update also refreshes the matching `INC_Startups` columns, but only for the newest quarter.
- **VAC attendance counts a session as held** if it is dated before today or already marked. The certificate needs ≥75% attendance and all assignments submitted. It is computed, never stored.

## Accounts
- **Launchpad mentor demo account `lp.mentor@example.com`** (password = `DEMO_ACCOUNT_PASSWORD`, memberships `none`). It signs in via `/signin` and opens `/launchpad/mentor`.
- **all@example.com is also a demo LP mentor** (`LP_Mentors` row `lpm-demo`), so one login opens the mentor view (follow-up brief).
  - A mentor never sees or acts on their own student record (403, server-side).
  - The Launchpad Overview shows a "Mentor view" link only for mentor accounts.
- **all@example.com's Students-tab password had drifted** from `DEMO_ACCOUNT_PASSWORD` (Consultees still used it). It was restored to the canonical seed value, the same thing `setup-startup-junction-tabs.mjs --reset-demo` does.

## Follow-up: My workspace button + Partner Services
- **One `BackToWorkspace` component** (`src/components/hub/BackToWorkspace.jsx`) links to `/hub/choose`, the existing My workspace page. Plain `/hub` would bounce one-workspace accounts straight back in.
  - `DashboardSidebar` / `DashboardMobileNav` render it from a `backTo` prop, passed by JunctionDashboard and PillarDashboard.
  - ConsultingShell renders it in its ink sidebar and mobile top bar.
- **Partner Services reuses PillarDashboard.** The only writes are: mark a report Submitted with a link (key: report + period), and update the primary contact (name/email/phone).
- **Partner Overview numbers are computed** from the PS_* rows:
  - active programs = status Active
  - funds disbursed = the newest disbursement period ("this cycle")
  - reports due = not Submitted
  - renewals = renewal date ≥ today

  Seed dates are the framework's, verbatim, so the quarterly report (due 30 Sep 2026) shows as overdue today.
- **The brief said all@ should see "10 workspaces".** `hubPillars.js` has 6 user workspaces (Startup Junction, Consulting, Launchpad Abroad, Incubation, VAC Learner, Partner Services) plus admin-only Hub Admin, which all@ must never get. all@ gets all 6; nothing was invented to reach 10.
- **Seeds live in `scripts/setup-hub-pillars-tabs.mjs`**, built on `scripts/lib/sheetSetup.mjs`.
  - The shared demo-memberships seed (`demoMemberships`) moved into sheetSetup.mjs.
  - `ensureTabs` now reads every header row in one batchGet, so 30+ tabs stay under the 60 reads/min quota.
- **Remotes:** the remote the brief calls `brevitty-live` is named `old-origin-do-not-push` in this clone. Only `origin` (dweep1128/brevitty-demo) is pushed.

## Consulting admin panel (2026-10-05)
- **Extended the existing admin app instead of rebuilding it**: it already had Overview/Students/Schedule/Sessions, the Admins-tab role gate and 403s. Moved it to `/hub/consulting-admin` (`ADMIN_BASE`); `/consulting/admin` redirects.
- **Cancel now archives at once** (`archived=TRUE`), so a cancelled session vanishes from both ends without a second "remove" step. Reviving it clears the flag.
- **Students = the `Consultees` tab** (UI says "Students"). Email is the key and is not editable; edit + reset password go through `PATCH admin/consultees`.
- **No lint script exists** in package.json, so only `vite build` and `node --check` were run.

## 2026-10-08: Incubation load fix, Profile, Partner Services removed
- **Why /hub/incubation was blank:** the INC_SchemeList and INC_SchemeStatus tabs did not exist in the sheet, so `getIncubation` threw and the API answered 503. Fixed by running `setup-hub-pillars-tabs.mjs`.
- **Partner Services removed** (pillar, dashboard, `partnerSheet.js`, routes, setup/check scripts). The `PS_*` tabs are still in the sheet; delete them by hand if unwanted.
- **Profile** added to `INC_Startups`. **Envelope** `{ok,data}` applies to Incubation routes only; errors from every `/api/hub` route carry `ok:false`. Clients unwrap in `hubApi.js`.
- Old-schema columns/rows in INC_Startups / INC_KPIs / INC_Funding are ignored by the code, not deleted.

## 2026-10-12: Hub on real data end to end (execute-only brief)
- **Hub Admin built** (`/hub/admin`, `api/_lib/hubAdmin.js`, `src/components/hubadmin/`). Five pages, all computed from the tabs; `comingSoon` removed everywhere. Admin = the `admin` membership, which only the Admins tab grants; every `/api/hub/admin/*` route checks it server-side (401 / 403). User management writes the Students tab (plus a Consultees row for new consulting users); consulting access for existing users stays in Consulting admin.
- **At-risk rules** (constants at the top of `hubAdmin.js`): missing MoM/deliverables/tasks on finished consulting sessions, ≥3 overdue tasks = high, attendance under 75% with ≥2 sessions held (under 50% = high), MoU renewal within 60 days (≤30 or overdue = high), no MoU, KPI quarter not reported, Launchpad no ticks for 30 days, VAC overdue assignments.
- **Envelope `{ok,data,error}` on every data endpoint** (`/api/hub/*`, `/api/consulting/*`, `/api/checklist`, `/api/session-progress`). `/api/login`, `/api/me`, `/api/logout`, `/api/change-password` are auth and were not touched. Clients unwrap in `hubApi.js` / `consultingApi.js`.
- **Startup routes now need the `startup` membership** (they only needed a session before).
- **Header-name column lookup everywhere**: Documents, Mentors, MentorAssignments, SessionProgress, ChecklistStatus, Attendance and the consulting store no longer use fixed column indexes. Sheet cache TTL is 30 s (every write still invalidates).
- **MoU renewal is computed** (`uploaded_at` + 3 years on read); `INC_Documents.renewal_date` is no longer written.
- **File fields**: Supabase upload is wired but its env vars are not set locally, so MoU/Documents/Funding also accept a pasted link (stored as `file_path`).
- **Competitions** moved out of `journeyData.js` into `Competitions` / `CompetitionEntries`; template / sample buttons come from `ItemResources` and only render when a URL exists. Dead mock data deleted (`mockJunctionDashboard.js`, community posts, cohort stats).
- **Attendance tab stays long-format** (`email, session_id, date, status`), as it is in the live sheet, not the wide format in the brief.
- **Seeds**: `scripts/setup-sheets.js` + `scripts/seed-demo.js` (upsert by key, dates relative to today in IST, never deletes). The old `setup-*-tabs.mjs --reset-demo` scripts restore the OLD seed and must not be run after this one; `check-hub-api.mjs` asserts the old seed's exact rows and will report mismatches (use `check-hub-admin.mjs` and `check-hub-writes.mjs`).
- **Launchpad demo student** is a Grade 12 school record in Jaipur while the same login is a GCEC Jaipur student elsewhere: the demo account spans workspaces, so the Launchpad record keeps its school fields.
- **No lint script** exists (no ESLint in the project); `vite build` plus the check scripts were run instead.

## 2026-10-13: Mentors and Attendance retired from the Hub
- **Retired, not deleted**: the `Attendance`, `Mentors`, `MentorAssignments`, `LP_Mentors` and `VAC_Attendance` tabs (and the `mentor_id` / `mentor` columns in `LP_*` and `MentorSessions`) are no longer read or written by the app. Their rows are untouched. They are no longer created by `scripts/setup-sheets.js`; delete them by hand when you are sure.
- **Sessions stay**: cohort sessions (tab keeps its historical name `MentorSessions`), consulting sessions, Launchpad sessions and VAC classes are unchanged, minus the mentor name.
- **Launchpad staff review moved** to Hub Admin > Launchpad students (`/api/hub/admin/launchpad*`, admin check on every call). The `/launchpad/mentor` login path is gone (the URL redirects to `/hub/launchpad`). Scheduling now blocks a clash for the same student instead of the same mentor; sign-off records the admin's name.
- **VAC certificate** is now eligible = every assignment submitted (it used to also need 75% attendance). Needs your decision if you want a different rule.
- **At-risk / workload / reports**: the "low attendance" flags and the attendance and mentor columns are gone. Workload now has one row each for the Startup Junction cohort and the Launchpad team instead of one per mentor.
- **Public website untouched**: `/mentors`, the home-page mentor strip and `/admin` founder tool are marketing content, not the Hub.

## 2026-10-13: Sheet tidy
- `MentorSessions` is now `CohortSessions` (constant, code, docs). `setup-sheets.js` renames the live tab in place (rows kept) and orders + colours every tab by pillar (`scripts/lib/tabGroups.mjs`).
- 17 tabs are not used by the app (5 retired, 12 unreferenced). `scripts/_clean-tabs.mjs` deletes them: dry run by default, `--apply` to delete. Backup first: `node scripts/backup-sheet.mjs`. See `SHEET_TABS.md`.
