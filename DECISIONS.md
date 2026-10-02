# Decisions log

Non-trivial calls made while building Launchpad Abroad, Incubation, VAC Learner and Partner Services (2026-10-02, autopilot).

## Pillars
- **"Mentorship & Profile Building" removed from `hubPillars.js`**: it is the same pillar as Launchpad Abroad, renamed. A roster cell still saying `mentorship:approved` is ignored by the roster parser (a warning, not an error).
- **Incubation, VAC Learner and Partner Services lost `comingSoon`**: they open real dashboards. Hub Admin stays coming soon.
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
