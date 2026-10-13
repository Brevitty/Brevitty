import { useState } from 'react'
import { motion } from 'framer-motion'
import { KPI_METRICS, SCHEME_STATUSES, STARTUP_STAGES, docStatus, formatINR, formatKpi } from '../../data/incubationRules.js'
import { saveKpis, saveProfile, setSchemeStatus } from '../../lib/db.ts'
import { formatDate } from '../../lib/hubApi.js'
import {
  Page, ViewHeader, StatGrid, StatTile, Card, CardHead, ListRow, DataTable, Pill, LinkOut, Field, EmptyNote,
  inputClass, primaryButton, labelClass, viewItem,
} from '../hub/ui.jsx'

const KPI_RECENT_QUARTERS = 4
export const KPI_EMPTY = 'No KPIs reported yet. Add your first quarter below.'

/* ---------------- Overview ---------------- */
export function OverviewView({ data, navigate }) {
  const mou = data.documents.find((d) => d.kind === 'mou')
  const latestPeriod = data.quarters.at(-1)?.period
  return (
    <Page>
      <ViewHeader eyebrow="Incubation" title={data.startup.startup} subtitle="Your incubation workspace, as you’ve reported it." />
      <StatGrid>
        <StatTile n={1} label="MoU" value={docStatus(mou)} sub={mou ? `Renewal · ${formatDate(mou.renewal_date)}` : 'Upload your signed MoU'} />
        <StatTile n={2} label="Documents" value={String(data.documents.length)} sub={data.documents.length ? 'On record' : 'None uploaded yet'} />
        <StatTile n={3} label="Funding received" value={data.funding.length ? formatINR(data.fundingReceived) : '—'} sub={data.funding.length ? `${data.funding.length} record${data.funding.length === 1 ? '' : 's'}` : 'No funding recorded yet'} />
        <StatTile n={4} label="Latest KPIs" value={latestPeriod || '—'} sub={latestPeriod ? 'Most recent quarter reported' : 'No KPIs reported yet'} />
      </StatGrid>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHead n={1} title="Latest KPIs" action={<button type="button" onClick={() => navigate('kpis')} className="text-xs font-semibold text-black/45 hover:text-orange">KPIs →</button>} />
          <div className="mt-3">
            {!latestPeriod && <p className="py-3 text-sm text-black/55">No KPIs reported yet.</p>}
            {latestPeriod && data.kpis.map((k) => <ListRow key={k.id} label={k.label} value={k.current === null ? '—' : formatKpi(k.unit, k.current)} />)}
          </div>
        </Card>
        <Card>
          <CardHead n={2} title="Next actions" />
          <div className="mt-3">
            {!data.nextActions.length && <p className="py-3 text-sm text-black/55">Nothing due. You’re all caught up.</p>}
            {data.nextActions.map((a) => (
              <div key={a.label} className="flex items-center justify-between gap-4 border-b border-black/[0.06] py-3 last:border-0">
                <span className="text-sm text-black/65">{a.label}</span>
                <Pill>{a.status}</Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}

/* ---------------- Profile ---------------- */
const PROFILE_FIELDS = ['startup', 'founder_name', 'sector', 'stage', 'website']

// Also the first screen for a newly approved founder: saving it creates their incubation record.
export function ProfileView({ data, run }) {
  const isNew = !data.startup
  const [form, setForm] = useState(() => Object.fromEntries(PROFILE_FIELDS.map((f) => [f, data.startup?.[f] || ''])))
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    await run(() => saveProfile(form), isNew ? 'Your incubation workspace is ready.' : 'Profile saved.')
    setSaving(false)
  }
  return (
    <Page>
      <ViewHeader
        eyebrow={isNew ? 'Welcome to Incubation' : 'Profile'}
        title={isNew ? 'Set up your startup.' : 'Your startup details.'}
        subtitle={isNew ? 'Start with your startup’s name. Documents, KPIs, funding and schemes open as soon as you save.' : 'Only you and the Hub team see these details.'}
      />
      <motion.form variants={viewItem} onSubmit={submit} className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Startup name" htmlFor="pf-startup">
          <input id="pf-startup" required maxLength={120} value={form.startup} onChange={set('startup')} disabled={saving} className={inputClass} />
        </Field>
        <Field label="Founder name" htmlFor="pf-founder">
          <input id="pf-founder" maxLength={120} value={form.founder_name} onChange={set('founder_name')} disabled={saving} className={inputClass} />
        </Field>
        <Field label="Sector" htmlFor="pf-sector">
          <input id="pf-sector" maxLength={80} value={form.sector} onChange={set('sector')} disabled={saving} className={inputClass} />
        </Field>
        <Field label="Stage" htmlFor="pf-stage">
          <select id="pf-stage" value={form.stage} onChange={set('stage')} disabled={saving} className={inputClass}>
            <option value="">Select stage</option>
            {STARTUP_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Website" htmlFor="pf-website">
          <input id="pf-website" type="url" placeholder="https://" value={form.website} onChange={set('website')} disabled={saving} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? 'Saving…' : isNew ? 'Create my workspace' : 'Save profile'}
          </button>
        </div>
      </motion.form>
    </Page>
  )
}

/* ---------------- KPIs ---------------- */
// "Q3 2026" and the KPI_RECENT_QUARTERS - 1 before it.
function recentQuarters(thisQuarter) {
  let q = Number(thisQuarter[1])
  let y = Number(thisQuarter.slice(3))
  const out = []
  for (let i = 0; i < KPI_RECENT_QUARTERS; i++) {
    out.push(`Q${q} ${y}`)
    q -= 1
    if (q === 0) {
      q = 4
      y -= 1
    }
  }
  return out
}

const blankValues = () => Object.fromEntries(KPI_METRICS.map((m) => [m.id, '']))

function KpiForm({ data, run }) {
  const [period, setPeriod] = useState(data.thisQuarter)
  const [values, setValues] = useState(blankValues)
  const [saving, setSaving] = useState(false)
  const existing = data.quarters.find((q) => q.period === period)
  const filled = KPI_METRICS.filter((m) => values[m.id] !== '')

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    const res = await run(() => saveKpis({ period, values }), `${period} KPIs saved.`)
    setSaving(false)
    if (res) setValues(blankValues())
  }

  return (
    <motion.form variants={viewItem} onSubmit={submit} className="mt-8 rounded-2xl border border-orange/30 bg-orange/[0.04] p-6">
      <CardHead title="Update quarterly KPIs" />
      <p className="mt-2 text-sm text-black/55">
        {existing ? `${period} is already reported. Leave a field blank to keep it as is.` : 'Enter all three values for the quarter.'} Saving also refreshes your Overview.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Quarter" htmlFor="kpi-period">
          <select id="kpi-period" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={saving} className={inputClass}>
            {recentQuarters(data.thisQuarter).map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </Field>
        {KPI_METRICS.map((m) => (
          <Field key={m.id} label={m.label} htmlFor={`kpi-${m.id}`}>
            <input
              id={`kpi-${m.id}`}
              type="number"
              inputMode="decimal"
              required={existing?.[m.id] == null}
              min="0"
              max={m.max}
              step={m.integer ? '1' : 'any'}
              placeholder={existing?.[m.id] ?? ''}
              value={values[m.id]}
              disabled={saving}
              onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
              className={inputClass}
            />
          </Field>
        ))}
      </div>
      <div className="mt-5">
        <button type="submit" disabled={saving || (existing && !filled.length)} className={primaryButton}>
          {saving ? 'Saving…' : `Save ${period} KPIs`}
        </button>
      </div>
    </motion.form>
  )
}

export function KpisView({ data, run }) {
  return (
    <Page>
      <ViewHeader eyebrow="KPIs" title="Current operating indicators." subtitle="Report each quarter here; the Hub team reviews them at your quarterly advisory." />
      <div className="mt-10">
        {!data.quarters.length ? (
          <EmptyNote>{KPI_EMPTY}</EmptyNote>
        ) : (
          <DataTable
            rowKey={(r) => r.id}
            rows={data.kpis}
            columns={[
              { key: 'label', label: 'Metric', width: '1fr' },
              { key: 'current', label: 'Current', width: '140px', render: (r) => <span className="font-mono font-semibold">{formatKpi(r.unit, r.current ?? NaN)}</span> },
              { key: 'trend', label: 'Trend', width: '130px', render: (r) => (r.trend ? <Pill>{r.trend}</Pill> : '—') },
              {
                key: 'history',
                label: 'History',
                width: '1.4fr',
                render: (r) => <span className="font-mono text-xs text-black/55">{r.history.map((h) => `${h.period}: ${formatKpi(r.unit, h.value)}`).join('  →  ') || '—'}</span>,
              },
            ]}
          />
        )}
      </div>
      <KpiForm data={data} run={run} />
    </Page>
  )
}

/* ---------------- Schemes (team-curated, read-only; the startup only tracks its own status) ---------------- */
export function SchemesView({ data, run }) {
  const [busy, setBusy] = useState('')
  async function change(scheme, status) {
    setBusy(scheme.id)
    await run(() => setSchemeStatus(scheme.id, status), `${scheme.name}: marked ${status}.`)
    setBusy('')
  }
  return (
    <Page>
      <ViewHeader eyebrow="Schemes" title="Government & ecosystem schemes." subtitle="Schemes the Hub team has listed for startups like yours. Track where you stand on each." />
      <div className="mt-10 flex flex-col gap-4">
        {!data.schemes.length && <EmptyNote>No schemes listed yet. The Hub team will add relevant ones.</EmptyNote>}
        {data.schemes.map((s, i) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={labelClass}>
                  <span className="mr-2 text-black/30">[{String(i + 1).padStart(2, '0')}]</span>
                  {s.authority || 'Scheme'}
                </p>
                <h3 className="mt-2 font-display text-lg font-bold text-ink">{s.name}</h3>
                {s.description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-black/60">{s.description}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                <label htmlFor={`scheme-${s.id}`} className={labelClass}>
                  Your status
                </label>
                <select id={`scheme-${s.id}`} value={s.my_status} disabled={busy === s.id} onChange={(e) => change(s, e.target.value)} className={`${inputClass} sm:w-44`}>
                  <option value="" disabled>
                    Set status
                  </option>
                  {SCHEME_STATUSES.map((st) => (
                    <option key={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <ListRow label="Eligibility" value={s.eligibility} />
              <ListRow label="Max benefit" value={s.max_benefit} />
              <ListRow label="Deadline" value={s.deadline ? formatDate(s.deadline) : ''} />
            </div>
            {s.apply_url && (
              <p className="mt-3 text-sm">
                <LinkOut href={s.apply_url}>Apply / Learn more</LinkOut>
              </p>
            )}
          </Card>
        ))}
      </div>
    </Page>
  )
}
