import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useJunctionFetch } from '../../lib/useJunctionFetch.js'
import { hubPost, formatDate } from '../../lib/hubApi.js'
import { formatINR } from '../../data/incubationRules.js'
import {
  Page, ViewHeader, StatGrid, StatTile, Card, CardHead, DataTable, Pill, EmptyNote, Field, SaveNote, LoadingView, ErrorView,
  inputClass, primaryButton, ghostButton, viewItem,
} from '../hub/ui.jsx'

const SEVERITY_TONE = { high: 'warn', medium: 'active', low: 'neutral' }
const STATUS_OPTIONS = [
  { value: '', label: 'No access' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
]
const TEAM_LABEL = { consulting: 'Consulting', startup: 'Startup Junction', launchpad: 'Launchpad Abroad', vac: 'VAC Learner' }
const CONSULTING_ADMIN_PATH = '/hub/consulting-admin'
const GENERATED_PASSWORD_LEN = 10
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// One fetch per view: shows a skeleton, an error with retry, then the view. Every number comes from the API.
function useAdminData(path, onUnauthorized, label) {
  const load = useJunctionFetch(`/api/hub/${path}`, onUnauthorized)
  const gate = load.loading && !load.data ? <LoadingView label={label} /> : load.error && !load.data ? <ErrorView message={load.error} onRetry={load.refetch} /> : null
  return { ...load, gate }
}

/* ---------------- Master Dashboard ---------------- */
export function MasterView({ onUnauthorized, onNavigate }) {
  const { data, gate, refetch } = useAdminData('admin/overview', onUnauthorized, 'Loading the master dashboard…')
  const [note, setNote] = useState({})
  if (gate) return gate
  const { totals, byPillar, pendingApprovals, topFlags, mouRenewals, upcomingThisWeek } = data

  async function decide(item, status) {
    const key = `${item.email}:${item.pillar}`
    setNote((n) => ({ ...n, [key]: { saving: true } }))
    try {
      await hubPost('admin/users/update', { email: item.email, memberships: { [item.pillar]: status } })
      setNote((n) => ({ ...n, [key]: { saved: true } }))
      refetch()
    } catch (err) {
      setNote((n) => ({ ...n, [key]: { error: err.message } }))
    }
  }

  return (
    <Page>
      <ViewHeader eyebrow="Hub Admin" title="Master dashboard." subtitle={`Live from the Hub sheet as of ${formatDate(data.today)}. Nothing here is typed in by hand.`} />
      <StatGrid>
        <StatTile n={1} label="Members" value={String(totals.users)} sub="Accounts across all workspaces" />
        <StatTile n={2} label="Pending approvals" value={String(totals.pendingApprovals)} sub={totals.pendingApprovals ? 'Waiting for a decision' : 'Nothing waiting'} />
        <StatTile n={3} label="At-risk members" value={String(totals.atRiskUsers)} sub={`${totals.highRiskUsers} high severity`} />
        <StatTile n={4} label="Sessions this week" value={String(totals.sessionsThisWeek)} sub="Across all workspaces" />
        <StatTile n={5} label="Missing items" value={String(totals.missingItems)} sub="Past sessions without MoM, tasks or deliverables" />
        <StatTile n={6} label="MoU renewals due" value={String(totals.mouRenewalsDue)} sub="Within 60 days or overdue" />
        <StatTile n={7} label="Funding received" value={formatINR(totals.fundingReceived)} sub="Reported by incubated startups" />
        <StatTile n={8} label="Workspaces" value={String(byPillar.length)} sub="Open to members" />
      </StatGrid>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHead n={1} title="Membership by workspace" />
          <div className="mt-4">
            <DataTable
              numbered={false}
              rows={byPillar}
              rowKey={(r) => r.pillar}
              columns={[
                { key: 'title', label: 'Workspace', width: '1.6fr' },
                { key: 'approved', label: 'Approved', width: '80px' },
                { key: 'pending', label: 'Pending', width: '80px' },
                { key: 'atRisk', label: 'At risk', width: '70px' },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHead n={2} title="Sessions in the next 7 days" />
          <div className="mt-4">
            <DataTable
              numbered={false}
              rows={Object.entries(upcomingThisWeek).map(([team, n]) => ({ team, n }))}
              rowKey={(r) => r.team}
              columns={[
                { key: 'team', label: 'Team', render: (r) => TEAM_LABEL[r.team] ?? r.team },
                { key: 'n', label: 'Sessions', width: '90px' },
              ]}
            />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHead n={3} title="Pending approvals" />
          <div className="mt-4">
            {!pendingApprovals.length ? (
              <EmptyNote>No requests waiting. New workspace requests from members show up here to approve or reject.</EmptyNote>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingApprovals.map((p) => {
                  const key = `${p.email}:${p.pillar}`
                  return (
                    <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                        <p className="truncate text-xs text-black/50">{p.email} · {p.pillarTitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SaveNote state={note[key]} />
                        <button type="button" onClick={() => decide(p, 'approved')} disabled={note[key]?.saving} className={primaryButton}>Approve</button>
                        <button type="button" onClick={() => decide(p, 'rejected')} disabled={note[key]?.saving} className={ghostButton}>Reject</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHead n={4} title="Needs attention" action={<button type="button" onClick={() => onNavigate('at-risk')} className="text-xs font-semibold text-black/45 hover:text-orange">All flags →</button>} />
          <div className="mt-4">
            {!topFlags.length ? (
              <EmptyNote>No one is flagged right now.</EmptyNote>
            ) : (
              topFlags.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3 border-b border-black/[0.06] py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{f.name} <span className="font-normal text-black/45">· {f.pillarTitle}</span></p>
                    <p className="text-xs text-black/55">{f.title}: {f.detail}</p>
                  </div>
                  <Pill tone={SEVERITY_TONE[f.severity]}>{f.severity}</Pill>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <CardHead n={5} title="MoU renewals" />
          <div className="mt-4">
            {!mouRenewals.length ? (
              <EmptyNote>No MoUs on record yet. Renewal dates appear once a startup uploads its signed MoU.</EmptyNote>
            ) : (
              mouRenewals.map((m) => (
                <div key={m.email} className="flex items-center justify-between gap-3 border-b border-black/[0.06] py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{m.startup}</p>
                    <p className="text-xs text-black/50">Uploaded {formatDate(m.uploaded)} · renews {formatDate(m.renewal)}</p>
                  </div>
                  <Pill tone={m.days <= 60 ? 'warn' : 'neutral'}>{m.days < 0 ? `${-m.days}d overdue` : `${m.days}d left`}</Pill>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </Page>
  )
}

/* ---------------- At-Risk Flags ---------------- */
export function AtRiskView({ onUnauthorized }) {
  const { data, gate } = useAdminData('admin/at-risk', onUnauthorized, 'Loading flags…')
  const [pillar, setPillar] = useState('')
  const [severity, setSeverity] = useState('')
  const flags = useMemo(() => data?.flags ?? [], [data])
  const pillars = useMemo(() => [...new Map(flags.map((f) => [f.pillar, f.pillarTitle])).entries()], [flags])
  if (gate) return gate
  const visible = flags.filter((f) => (!pillar || f.pillar === pillar) && (!severity || f.severity === severity))
  return (
    <Page>
      <ViewHeader
        eyebrow="At-risk flags"
        title="Who needs a nudge."
        subtitle="Computed live: missing MoM or deliverables, overdue tasks, attendance under 75%, MoU renewals within 60 days, and stalled progress."
      />
      <motion.div variants={viewItem} className="mt-8 flex flex-wrap gap-3">
        <select aria-label="Filter by workspace" value={pillar} onChange={(e) => setPillar(e.target.value)} className={`${inputClass} sm:max-w-[240px]`}>
          <option value="">All workspaces</option>
          {pillars.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <select aria-label="Filter by severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={`${inputClass} sm:max-w-[200px]`}>
          <option value="">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span className="self-center text-sm text-black/50">{visible.length} of {flags.length} flags</span>
      </motion.div>
      <div className="mt-6">
        <DataTable
          rows={visible}
          rowKey={(f) => f.id}
          empty={flags.length ? 'No flags match these filters. Clear a filter to see the rest.' : 'No one is flagged. Flags appear automatically when a member misses MoM, falls below 75% attendance, or an MoU is close to renewal.'}
          columns={[
            { key: 'name', label: 'Member', width: '1.2fr', render: (f) => <><span className="font-semibold">{f.name}</span><span className="block text-xs text-black/45">{f.email}</span></> },
            { key: 'pillarTitle', label: 'Workspace', width: '1fr' },
            { key: 'title', label: 'Issue', width: '1fr' },
            { key: 'detail', label: 'Detail', width: '1.6fr' },
            { key: 'severity', label: 'Severity', width: '90px', render: (f) => <Pill tone={SEVERITY_TONE[f.severity]}>{f.severity}</Pill> },
          ]}
        />
      </div>
    </Page>
  )
}

/* ---------------- Workload ---------------- */
export function WorkloadView({ onUnauthorized }) {
  const { data, gate } = useAdminData('admin/workload', onUnauthorized, 'Loading workload…')
  if (gate) return gate
  return (
    <Page>
      <ViewHeader eyebrow="Workload" title="Who is carrying what." subtitle="Mentors, consultants and faculty, with what is on their plate this week and what is still pending." />
      <div className="mt-8">
        <DataTable
          rows={data.rows}
          rowKey={(r) => `${r.team}:${r.name}`}
          empty="No mentors or faculty on record yet. They appear here once they are added to the Mentors, LP_Mentors or VAC_Learners tabs."
          columns={[
            { key: 'name', label: 'Name', width: '1.3fr', render: (r) => <><span className="font-semibold">{r.name}</span><span className="block text-xs text-black/45">{r.team}</span></> },
            { key: 'students', label: 'Students', width: '80px' },
            { key: 'upcoming', label: 'Next 7 days', width: '100px' },
            { key: 'pending', label: 'Pending', width: '80px', render: (r) => (r.pending ? <Pill tone="active">{r.pending}</Pill> : '0') },
            { key: 'overdue', label: 'Overdue', width: '80px', render: (r) => (r.overdue ? <Pill tone="warn">{r.overdue}</Pill> : '0') },
            { key: 'note', label: 'What counts', width: '1.6fr', render: (r) => <span className="text-xs text-black/50">{r.note}</span> },
          ]}
        />
      </div>
    </Page>
  )
}

/* ---------------- Reports ---------------- */
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
function downloadCsv(report) {
  const lines = [report.columns.map((c) => csvCell(c.label)).join(','), ...report.rows.map((r) => report.columns.map((c) => csvCell(r[c.key])).join(','))]
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `brevitty-${report.id}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsView({ onUnauthorized }) {
  const { data, gate } = useAdminData('admin/reports', onUnauthorized, 'Building reports…')
  if (gate) return gate
  return (
    <Page>
      <ViewHeader eyebrow="Reports" title="Cohort reports." subtitle={`One table per workspace, computed from the sheet as of ${formatDate(data.today)}. Download any of them as CSV.`} />
      <div className="mt-8 flex flex-col gap-5">
        {data.reports.map((r, i) => (
          <Card key={r.id}>
            <CardHead n={i + 1} title={r.title} action={<button type="button" onClick={() => downloadCsv(r)} disabled={!r.rows.length} className={ghostButton}>Download CSV</button>} />
            <div className="mt-4 overflow-x-auto">
              <DataTable
                numbered={false}
                rows={r.rows}
                rowKey={(row, idx) => `${r.id}-${idx}`}
                empty="No rows yet for this report."
                columns={r.columns.map((c, ci) => ({ key: c.key, label: c.label, width: ci === 0 ? '1.3fr' : '1fr' }))}
              />
            </div>
          </Card>
        ))}
      </div>
    </Page>
  )
}

/* ---------------- User management ---------------- */
const generatePassword = () => {
  const bytes = crypto.getRandomValues(new Uint32Array(GENERATED_PASSWORD_LEN))
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('')
}
const EMPTY_NEW = { name: '', email: '', password: '', memberships: {}, consulting: false, department: '', course: '', sem: '', phone: '', startup_name: '' }

function AddUserForm({ pillars, onCreated }) {
  const [form, setForm] = useState(EMPTY_NEW)
  const [state, setState] = useState({})
  const [created, setCreated] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setStatus = (pillar) => (e) => setForm((f) => ({ ...f, memberships: { ...f.memberships, [pillar]: e.target.value } }))

  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    const { consulting, department, course, sem, phone, startup_name, ...rest } = form
    try {
      const res = await hubPost('admin/users', { ...rest, consulting: consulting ? { department, course, sem, phone, startup_name } : undefined })
      setCreated(res)
      setForm(EMPTY_NEW)
      setState({ saved: true })
      onCreated()
    } catch (err) {
      setState({ error: err.message })
    }
  }

  return (
    <Card className="mt-8">
      <CardHead n={1} title="Add a user" />
      <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="nu-name"><input id="nu-name" required maxLength={200} value={form.name} onChange={set('name')} className={inputClass} /></Field>
        <Field label="Official email" htmlFor="nu-email"><input id="nu-email" required type="email" maxLength={254} value={form.email} onChange={set('email')} className={inputClass} /></Field>
        <Field label="Password" htmlFor="nu-pass" hint="Leave blank to generate one. It is shown once after saving.">
          <div className="flex gap-2">
            <input id="nu-pass" minLength={6} maxLength={128} value={form.password} onChange={set('password')} autoComplete="off" className={inputClass} />
            <button type="button" onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))} className={ghostButton}>Generate</button>
          </div>
        </Field>
        <div className="sm:col-span-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Workspace access</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <label key={p.id} className="flex flex-col gap-1 text-sm text-ink">
                {p.title}
                <select value={form.memberships[p.id] || ''} onChange={setStatus(p.id)} className={inputClass}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={form.consulting} onChange={(e) => setForm((f) => ({ ...f, consulting: e.target.checked }))} className="h-4 w-4 accent-orange" />
            Also give Consulting access (creates a Consulting student)
          </label>
        </div>
        {form.consulting && (
          <>
            <Field label="Department" htmlFor="nu-dept"><input id="nu-dept" maxLength={200} value={form.department} onChange={set('department')} className={inputClass} /></Field>
            <Field label="Course" htmlFor="nu-course"><input id="nu-course" maxLength={200} value={form.course} onChange={set('course')} className={inputClass} /></Field>
            <Field label="Semester" htmlFor="nu-sem"><input id="nu-sem" maxLength={20} value={form.sem} onChange={set('sem')} className={inputClass} /></Field>
            <Field label="Phone" htmlFor="nu-phone"><input id="nu-phone" maxLength={20} value={form.phone} onChange={set('phone')} className={inputClass} /></Field>
            <Field label="Startup name" htmlFor="nu-startup"><input id="nu-startup" maxLength={200} value={form.startup_name} onChange={set('startup_name')} className={inputClass} /></Field>
          </>
        )}
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="submit" disabled={state.saving} className={primaryButton}>{state.saving ? 'Creating…' : 'Create user'}</button>
          <SaveNote state={state.error ? { error: state.error } : null} />
        </div>
      </form>
      {created && (
        <div role="status" className="mt-4 rounded-xl border border-orange/30 bg-orange/10 px-4 py-3 text-sm text-ink">
          Created <strong>{created.name}</strong> ({created.email}). Password: <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono">{created.password}</code>. Share it securely; it is not shown again.
        </div>
      )}
    </Card>
  )
}

function UserRow({ user, pillars, onChange, onUnauthorized }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({})
  const [password, setPassword] = useState('')

  async function save(changes, success) {
    setState({ saving: true })
    try {
      await hubPost('admin/users/update', { email: user.email, ...changes })
      setState({ saved: true, message: success })
      setPassword('')
      onChange()
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      setState({ error: err.message })
    }
  }

  const isAdmin = user.role === 'admin'
  return (
    <div className="rounded-xl border border-black/10 bg-surface px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user.name || '—'} {isAdmin && <Pill tone="done">Admin</Pill>}</p>
          <p className="truncate text-xs text-black/50">{user.email}{user.startup ? ` · ${user.startup}` : ''}</p>
        </div>
        {!isAdmin && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={ghostButton}>{open ? 'Close' : 'Manage'}</button>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(user.memberships).map(([p, s]) => <Pill key={p} tone={s === 'approved' ? 'done' : s === 'pending' ? 'active' : 'warn'}>{pillars.find((x) => x.id === p)?.title ?? (p === 'consulting' ? 'Consulting' : p)} · {s}</Pill>)}
        {!Object.keys(user.memberships).length && <span className="text-xs text-black/45">No workspace access yet.</span>}
      </div>
      {open && (
        <div className="mt-4 border-t border-black/[0.06] pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <label key={p.id} className="flex flex-col gap-1 text-xs font-semibold text-black/60">
                {p.title}
                <select
                  value={user.memberships[p.id] || ''}
                  disabled={state.saving}
                  onChange={(e) => save({ memberships: { [p.id]: e.target.value } }, `${p.title} updated.`)}
                  className={inputClass}
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-black/50">
            Consulting access is managed in <a href={CONSULTING_ADMIN_PATH} className="font-semibold text-[#c2410c] underline-offset-4 hover:underline">Consulting admin</a>.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); save({ password }, 'Password reset.') }} className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="Reset password" htmlFor={`pw-${user.email}`}>
              <input id={`pw-${user.email}`} minLength={6} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className={inputClass} />
            </Field>
            <button type="submit" disabled={state.saving || password.length < 6} className={ghostButton}>Set password</button>
            <SaveNote state={state.error ? { error: state.error } : state.saving ? { saving: true } : null} />
            {state.saved && !state.error && <p role="status" className="text-xs font-medium text-black/50">{state.message}</p>}
          </form>
        </div>
      )}
    </div>
  )
}

export function UsersView({ onUnauthorized }) {
  const { data, gate, refetch } = useAdminData('admin/users', onUnauthorized, 'Loading users…')
  const [query, setQuery] = useState('')
  if (gate) return gate
  const q = query.trim().toLowerCase()
  const users = data.users.filter((u) => !q || `${u.name} ${u.email} ${u.startup}`.toLowerCase().includes(q))
  return (
    <Page>
      <ViewHeader eyebrow="User management" title="Members and access." subtitle="Reads and writes the Students tab. Changes take effect on the member's next sign-in." />
      <AddUserForm pillars={data.pillars} onCreated={refetch} />
      <Card className="mt-5">
        <CardHead n={2} title={`All users (${data.users.length})`} />
        <div className="mt-4">
          <input type="search" aria-label="Search users" placeholder="Search by name, email or startup" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} sm:max-w-sm`} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {users.length ? users.map((u) => <UserRow key={u.email} user={u} pillars={data.pillars} onChange={refetch} onUnauthorized={onUnauthorized} />) : <EmptyNote>{q ? `No users match “${query}”. Clear the search or add a new user above.` : 'No users yet. Add the first one above.'}</EmptyNote>}
        </div>
      </Card>
    </Page>
  )
}
