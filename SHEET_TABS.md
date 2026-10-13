# Sheet tabs

Every tab in the live Google Sheet, with who uses it. Order and colour match `scripts/lib/tabGroups.mjs`
(applied by `node scripts/setup-sheets.js`). Row counts are from the 2026-10-13 audit (all rows are demo or
seed data; no real-user rows exist). The full pre-clean backup is `sheet-backup-<timestamp>/` (git-ignored).

Status: **USED** (the app reads or writes it) · **RETIRED** (feature removed) · **UNREFERENCED** (nothing in
`src/`, `api/` or `scripts/` names it). Cleaning: `node scripts/_clean-tabs.mjs` (dry run) then `--apply`.

| Tab | Group | Status | Used by | Rows | Action |
|---|---|---|---|---|---|
| Students | Hub / Admin | USED | sign-in roster (`roster.js`), Hub Admin user management | 1 | keep |
| Admins | Hub / Admin | USED | admin sign-in and Consulting admin (`signIn.js`, `consulting/auth.js`) | 1 | keep |
| StartupProfiles | Startup Junction | USED | My Journey > My Startup, `GET /api/hub/dashboard` | 1 | keep |
| ChecklistStatus | Startup Junction | USED | journey checklist, `/api/checklist` | 8 | keep |
| Invoices | Startup Junction | USED | My Startup ledger, `GET dashboard` | 2 | keep |
| Documents | Startup Junction | USED | Startup Documents, `GET/POST /api/hub/documents` | 2 | keep |
| SessionProgress | Startup Junction | USED | Sessions progress + quiz, `/api/session-progress` | 0 | keep |
| CompetitionEntries | Startup Junction | USED | Competitions status and proof, `POST /api/hub/competitions` | 0 | keep |
| Activity | Startup Junction | USED | Overview recent activity, `GET dashboard` | 2 | keep |
| Consultees | Consulting | USED | consulting sign-in and student list (`consulting/store.js`) | 1 | keep |
| ConsultingSessions | Consulting | USED | consulting student and admin, `/api/consulting/*` | 4 | keep |
| Tasks | Consulting | USED | consulting tasks, `/api/consulting/*` | 2 | keep |
| Deliverables | Consulting | USED | consulting deliverables, `/api/consulting/*` | 2 | keep |
| LP_Students | Launchpad Abroad | USED | Launchpad intake/profile, Hub Admin > Launchpad students | 1 | keep |
| LP_Checklist | Launchpad Abroad | USED | Launchpad My Journey, `POST launchpad/checklist` | 6 | keep |
| LP_Profile | Launchpad Abroad | USED | Launchpad Profile, `POST launchpad/profile` | 4 | keep |
| LP_Documents | Launchpad Abroad | USED | Launchpad Documents, admin verify | 1 | keep |
| LP_Sessions | Launchpad Abroad | USED | Launchpad Sessions, admin schedule | 2 | keep |
| LP_Signoff | Launchpad Abroad | USED | Profile Ready sign-off (admin) | 0 | keep |
| LP_Feedback | Launchpad Abroad | USED | admin feedback, Launchpad Overview | 0 | keep |
| INC_Startups | Incubation | USED | Incubation Profile, `GET incubation` | 1 | keep |
| INC_KPIs | Incubation | USED | Incubation KPIs | 2 | keep |
| INC_Funding | Incubation | USED | Incubation Funding | 2 | keep |
| INC_Documents | Incubation | USED | MoU and Documents | 1 | keep |
| INC_SchemeStatus | Incubation | USED | Schemes (per-startup status) | 1 | keep |
| VAC_Learners | VAC Learner | USED | VAC enrolment and Overview, `GET vac` | 1 | keep |
| VAC_Sessions | VAC Learner | USED | VAC Schedule, Hub Admin > Content | 4 | keep |
| VAC_Content | VAC Learner | USED | VAC Content | 1 | keep |
| VAC_Assignments | VAC Learner | USED | VAC Assignments, certificate | 3 | keep |
| VAC_Feedback | VAC Learner | USED | VAC Feedback | 1 | keep |
| CohortSessions | Reference content | USED | Startup Sessions, Hub Admin > Content. Renamed from `MentorSessions` | 0 | keep |
| Competitions | Reference content | USED | Startup Competitions, Hub Admin > Content | 0 | keep |
| ItemResources | Reference content | USED | Startup journey template links, Hub Admin > Content | 3 | keep |
| INC_SchemeList | Reference content | USED | Incubation Schemes, Hub Admin > Content | 5 | keep |
| Attendance | none | RETIRED | nothing (feature removed) | 0 | delete |
| Mentors | none | RETIRED | nothing (feature removed) | 0 | delete |
| MentorAssignments | none | RETIRED | nothing (feature removed) | 0 | delete |
| LP_Mentors | none | RETIRED | nothing (feature removed) | 0 | delete |
| VAC_Attendance | none | RETIRED | nothing (feature removed); 3 demo rows | 3 | delete |
| INC_Compliance | none | UNREFERENCED | old Incubation design | 0 | delete |
| INC_Schemes | none | UNREFERENCED | old Incubation design (replaced by `INC_SchemeList`) | 0 | delete |
| INC_Media | none | UNREFERENCED | old Incubation design | 0 | delete |
| INC_Resources | none | UNREFERENCED | old Incubation design | 0 | delete |
| PS_Partners | none | UNREFERENCED | removed Partner Services workspace | 0 | delete |
| PS_Programs | none | UNREFERENCED | removed Partner Services workspace | 0 | delete |
| PS_Disbursements | none | UNREFERENCED | removed Partner Services workspace | 0 | delete |
| PS_Reports | none | UNREFERENCED | removed Partner Services workspace | 0 | delete |
| PS_Events | none | UNREFERENCED | removed Partner Services workspace | 0 | delete |
| PS_Contacts | none | UNREFERENCED | removed Partner Services workspace | 0 | delete |
| PS_Renewals | none | UNREFERENCED | removed Partner Services workspace | 0 | delete |
| PS_MoU | none | UNREFERENCED | removed Partner Services workspace | 0 | delete |

34 kept, 17 to delete. `ensureTabs()` renames `MentorSessions` to `CohortSessions` in place if it still exists.
