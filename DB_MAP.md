# DB_MAP: every Hub page, where its data comes from

Tab-by-tab status, order and colours: see `SHEET_TABS.md`. Cohort sessions live in the `CohortSessions` tab (renamed from `MentorSessions`). Demo cohort sessions use ids starting `cs_demo_` and are visible to the demo account only.

Google Sheets is the only database (`GOOGLE_SHEET_ID`, the roster's service account). Supabase Storage holds uploaded files only; a pasted link works wherever an upload does.
`email` is the join key everywhere; child rows have stable ids (`session_id`, `task_id`, `deliverable_id`, `doc_id`, `id`).
Every endpoint answers `{ ok, data, error }`. User endpoints are scoped to the session email and need an approved membership; admin endpoints need the `admin` membership, which only an email in the `Admins` tab ever gets (checked server-side, 403 otherwise). `all@example.com` is not an admin.

Data layer: `api/_lib/sheetsClient.js` (token, `values:batchGet` warm-up, 30 s tab cache cleared on every write), `api/_lib/pillarStore.js` and `api/_lib/consulting/store.js` (rows addressed by **header name**, never by column index).

Status of every page: **Sheet** = served from the tabs below, **Code** = definitions kept in code on purpose (see "Kept in code").

## Pillars in `src/data/hubPillars.js`

| id | Title | Opens | API |
|---|---|---|---|
| startup | Startup Junction Founder | `/hub/startup` | `/api/hub/{dashboard,mentors,mentor-assignments,documents,attendance,competitions}`, `/api/checklist`, `/api/session-progress` |
| consulting | Consulting | `/consulting` (own shell) | `/api/consulting/*` |
| launchpad | Launchpad Abroad | `/hub/launchpad`, mentor view `/launchpad/mentor` (also Hub Admin > Launchpad students) | `/api/hub/launchpad[/mentor…]` |
| incubation | Incubation | `/hub/incubation` | `/api/hub/incubation[/…]` |
| vac | VAC Learner | `/hub/vac` | `/api/hub/vac[/…]` |
| admin (adminOnly) | Hub Admin | `/hub/admin`, Consulting admin `/hub/consulting-admin` | `/api/hub/admin/*`, `/api/consulting/admin/*` |

Partner Services was removed earlier and is not a pillar. No pillar was invented.

## Hub shell pages

| Page | Shows | Source | Endpoint |
|---|---|---|---|
| `/signin`, `HubGate` | sign-in, session gate | Students / Consultees / Admins | `/api/login`, `/api/me` (auth: untouched) |
| My workspace `/hub/choose` | one card per approved pillar, 3 per row on desktop | memberships on the session | `/api/me` |
| `/hub/status`, `/hub/none` | pending / no-access explanations | memberships | `/api/me` |

## Startup Junction (`/hub/startup`)

| Page / section | Data | Tab (columns) | Endpoint |
|---|---|---|---|
| Sidebar card | team name, stage progress | `StartupProfiles.team_name`; stage computed from `ChecklistStatus` | dashboard + checklist |
| Overview | greeting, current stage, next action, next session, mentors, recent activity | `ChecklistStatus`, `Invoices`, `CompetitionEntries`, `CohortSessions`, `MentorAssignments`+`Mentors`, `Activity` | `GET dashboard`, `GET checklist`, `GET mentor-assignments`, `GET mentors` |
| My Journey: Home | stage rail, due-now items | same as Overview | same |
| My Journey: My Startup | checklist, one-pager, ledger | `ChecklistStatus` (email,item_id,checked,checked_date), `StartupProfiles` (email,startup_name,team_name,one_liner,description,problem,solution,product,interviews_run), `Invoices` (email,date,customer,amount,note), `ItemResources` (item_id,template_url,sample_url) | `GET/POST /api/checklist`, `GET dashboard` |
| My Journey: Competitions | catalogue + the student's status, star, proof links | `Competitions` (comp_id,name,org,about,eligibility,event_date,deadline,deadline_note,prize,url,checklist,active), `CompetitionEntries` (email,comp_id,status,saved,proof,updated_at) | `GET dashboard`, `POST competitions` |
| Toolkit | tool list, AI generation | tool definitions in code (`junctionTools.js`) | `/api/generate` |
| Mentors | assigned mentors (empty state: no mentor assigned yet) | `Mentors` (mentor_id,name,expertise,bio,contact_email), `MentorAssignments` (email,mentor_id,assigned_date) | `GET mentors`, `GET mentor-assignments` |
| Sessions | cohort sessions, per-student completion + quiz | `CohortSessions` (session_id,date,time,platform,mentor,topic,summary,action_item), `SessionProgress` (email,session_id,completed,quiz_score,completed_date) | `GET dashboard`, `GET/POST /api/session-progress` |
| Attendance | present ÷ sessions held so far, full list | `Attendance` (email,session_id,date,status; long format) + `CohortSessions` | `GET attendance` |
| Documents | status per catalogue doc | `Documents` (email,doc_id,status,submitted_date,file_url); catalogue in code | `GET documents` |

Journey stage is computed from the checklist on every read (`getStagesWithStatus`), never stored.

## Consulting (`/consulting`)

| Page | Data | Tabs | Endpoint |
|---|---|---|---|
| Student: Overview | upcoming, missing items (MoM / deliverables / tasks), rescheduled notice | `ConsultingSessions`, `Tasks`, `Deliverables` | `GET sessions` |
| Student: Sessions + session page | upcoming / previous, add MoM, deliverables, tasks, "No tasks / No deliverables", cancel | same | `PATCH sessions`, `POST deliverables`, `PATCH deliverables`, `PATCH tasks`, `PATCH sessions/flags`, `POST sessions/remove`, `POST sessions/seen` |
| Student: Deliverables, Tasks | per-student lists | `Deliverables`, `Tasks` | `GET sessions` |
| Admin: Today (`/hub/consulting-admin`) | today, missing from students / from me, overdue tasks, inactive students | all consulting tabs | `GET admin/summary` |
| Admin: Students, student detail, add / edit student | name, department, course, sem, phone, startup, email, password | `Consultees` | `GET/POST/PATCH admin/consultees`, `GET admin/consultee`, `GET admin/generate-password` |
| Admin: Schedule | slot picker, create session | `ConsultingSessions` | `GET/POST admin/sessions` |
| Admin: Sessions + detail | upcoming and past with tasks, deliverables, MoM; reschedule, cancel | consulting tabs | `GET admin/sessions`, `GET admin/session`, `PATCH admin/sessions`, `POST admin/sessions/remove`, task/deliverable routes |
| Admin: Tasks board | all tasks and deliverables by status | `Tasks`, `Deliverables` | `GET admin/board`, `PATCH admin/tasks|deliverables` |

"What is missing" is decided in one place (`api/_lib/consulting/missing.js`) so the student and admin ends always agree. Cancelling archives the row (`archived=TRUE`) and removes it from both ends; only admins reschedule.

## Launchpad Abroad (`/hub/launchpad`, mentor view `/launchpad/mentor`; admin review in Hub Admin > Launchpad students)

| Page | Data | Tab (columns) | Endpoint |
|---|---|---|---|
| Overview, My Journey | phase rail, checklist, sign-off | `LP_Checklist` (email,item_id,checked,checked_date), `LP_Signoff` (email,profile_ready,signed_by,date); phases in code | `GET launchpad`, `POST launchpad/checklist` |
| Profile | about, startup, activities, awards, proof | `LP_Students` (email,name,grade,school,guardian_*,mentor_id), `LP_Profile` (email,section,field,value) | `POST launchpad/profile` |
| Sessions | upcoming / past, MoM / deliverables / tasks | `LP_Sessions` (session_id,email,mentor_id,date,time,status,mom,deliverables,tasks), `LP_Mentors` | `POST launchpad/sessions` |
| Documents | submit links | `LP_Documents` (email,doc_id,status,submitted_date,link) | `POST launchpad/documents` |
| Mentor view: the mentor's students (login = `LP_Mentors.contact_email`) | phase, profile %, sign-off, documents waiting | all `LP_*` | `GET launchpad/mentor[/student]`, `POST launchpad/mentor/{feedback,schedule,verify,signoff}` |
| Hub Admin > Launchpad students | phase, profile %, sign-off, documents waiting; feedback, schedule, verify, sign off | all `LP_*` | `GET admin/launchpad[/student]`, `POST admin/launchpad/{feedback,schedule,verify,signoff}` (admin only) |

No Target Universities page exists.

## Incubation (`/hub/incubation`)

| Page | Data | Tab (columns) | Endpoint |
|---|---|---|---|
| Overview | MoU status, documents, funding, latest KPIs, next actions | all below | `GET incubation` |
| Profile | startup, founder, sector, stage, website | `INC_Startups` (email,startup,founder_name,sector,stage,website,updated_at) | `POST incubation/profile` |
| MoU & Documents (one page) | MoU + DPIIT + IP + other; upload or link; **MoU renewal = upload date + 3 years, computed on read** | `INC_Documents` (email,id,kind,title,file_name,file_path,status,uploaded_at,renewal_date unused) | `POST incubation/{upload-url,documents}`, `GET incubation/file-url` |
| KPIs | revenue, runway, jobs per quarter (user-entered) | `INC_KPIs` (email,quarter,revenue,runway_months,jobs_created,updated_at) | `POST incubation/kpis` |
| Funding | funder, type, amount, date, status, proof | `INC_Funding` (email,id,funder,type,amount,date,status,notes,file_name,file_path,created_at) | `POST incubation/funding[/delete]` |
| Schemes | government schemes + my status | `INC_SchemeList` (id,name,authority,description,eligibility,max_benefit,deadline,apply_url,active), `INC_SchemeStatus` (email,scheme_id,status,updated_at) | `POST incubation/schemes/status` |

Media & PR, Resources, Exit Status and the quarterly compliance checklist are gone from the UI, routes and fetches. The old `INC_Media`, `INC_Resources`, `INC_Compliance`, `INC_Schemes` tabs still exist in the sheet and are not read by any code.

## VAC Learner (`/hub/vac`)

| Page | Data | Tab (columns) | Endpoint |
|---|---|---|---|
| Overview, Course | learner, course, next class / assignment | `VAC_Learners` (email,name,roll_no,program,semester,course,batch,faculty) | `GET vac` |
| Schedule, Attendance | sessions, present ÷ held | `VAC_Sessions` (session_id,date,time,title,course,batch), `VAC_Attendance` (email,session_id,status) | `GET vac` |
| Content | per-course material | `VAC_Content` (course,title,format,status,link) | `GET vac` |
| Assignments | submit link | `VAC_Assignments` (assignment_id,email,title,due,status,link) | `POST vac/assignments` |
| Certificate | eligible = attendance ≥ 75% and all assignments in (computed) | derived | `GET vac` |
| Feedback | rating + comment per area | `VAC_Feedback` (email,area,rating,comment,submitted_date) | `POST vac/feedback` |

## Hub Admin (`/hub/admin`), computed from the tabs above, nothing stored

| Page | Data | Endpoint |
|---|---|---|
| Master Dashboard | members, pending approvals (approve / reject inline), at-risk count, sessions this week, missing items, MoU renewals due, funding received, membership by workspace, top flags, MoU renewals | `GET admin/overview` |
| At-Risk Flags | missing MoM / deliverables / tasks, overdue tasks, no recent session, attendance < 75% (Startup, VAC), overdue assignments, MoU renewal within 60 days or overdue, no MoU, KPI update due, Launchpad stalled > 30 days, documents awaiting verification | `GET admin/at-risk` |
| Workload | consulting desk, Startup mentors, Launchpad mentors, VAC faculty: students, next 7 days, pending, overdue | `GET admin/workload` |
| Reports | six tables (membership, consulting, startup, launchpad, incubation, vac) with CSV download | `GET admin/reports` |
| User Management | every user across tabs, workspace access per user, add user, change access, reset password | `GET admin/users`, `POST admin/users`, `POST admin/users/update` (Students tab; a Consultees row for new consulting users) |
| Attendance | pick a cohort session, mark each real founder present / absent (mark all present, edit past sessions), saved to `Attendance` | `GET admin/attendance[?session=]`, `POST admin/attendance` (admin only; demo accounts never listed) |
| Launchpad students | every real Launchpad student: phase, profile %, documents waiting; feedback, schedule, verify, sign off | `GET admin/launchpad[/student]`, `POST admin/launchpad/{feedback,schedule,verify,signoff}` |

## Kept in code on purpose (definitions, not data)

`journeyData.js` stages and deliverables, `launchpadChecklist.js` phases / profile fields / documents, `documentsData.js` document catalogue, `junctionTools.js` toolkit tools, `consultingConstants.js` slots and statuses, `incubationRules.js` / `vacRules.js` rules and formatting, `hubPillars.js` pillar list and nav.

## Phase 1 grep (mock / placeholder content) and what happened to each hit

| Hit | Where | Resolution |
|---|---|---|
| `mockJunctionDashboard.js` (STUDENT_PROFILE, MILESTONES, SESSIONS, RECENT_ACTIVITY) | `src/data` | unused; deleted (all of it already comes from `StartupProfiles`, `CohortSessions`, `Activity`) |
| `COMPETITIONS` | `journeyData.js`, JourneyView, OverviewView, JunctionDashboard | moved to `Competitions` + `CompetitionEntries` tabs, served by `GET dashboard`, saved by `POST competitions` |
| `COMMUNITY_POSTS`, `COHORT_STATS`, `MOVED_THIS_WEEK` | `journeyData.js` | unused anywhere; deleted |
| "Download template" / "See a sample" buttons with no handler | MyStartupView | real links from `ItemResources`; the button only renders when the sheet has a URL |
| "Download brief" disabled "PDF export coming soon" | MyStartupView | now downloads a text brief built from the student's `StartupProfiles` row |
| "+ Add proof" invented `proof-N.pdf` names | CompetitionsView | proof links saved to `CompetitionEntries.proof` |
| "Coming soon" workspace section and card badge | WorkspacePage, HubChoosePage, `hubPillars.js` | Hub Admin is built; `comingSoon` removed everywhere |
| `TODO: replace with real API/Sheets call` | `journeyData.js` | removed with the data |
| `placeholder="…"` | form inputs | HTML input hints, not content; kept |
| Marketing site (`/events`, `/mentors`, `/grants`, `/community`, `/admin` founder tool, home page logos) | `src/data/{events,mentors,mentorsFull,startups,grants,partners,store}.js` | public website content outside the Hub; not in scope |
