import { useState } from 'react'
import { motion } from 'framer-motion'
import { AttendanceMeter } from '../junction/dashboard/shared.jsx'
import { KPI_METRICS, formatINR, formatKpi } from '../../data/incubationRules.js'
import { formatDate } from '../../lib/hubApi.js'
import {
  Page, ViewHeader, StatGrid, StatTile, Card, CardHead, ListRow, DataTable, Pill, LinkOut, Field, SaveNote, EmptyNote,
  inputClass, primaryButton, ghostButton, viewItem,
} from '../hub/ui.jsx'

const KPI_RECENT_QUARTERS = 4
const DOC_TYPES = ['Legal', 'Governance', 'Agreement', 'Finance', 'IP', 'Other']

const kpi = (data, id) => data.kpis.find((k) => k.id === id)

/* ---------------- Overview ---------------- */
export function OverviewView({ data, navigate }) {
  const s = data.startup
  const revenue = kpi(data, 'revenue')
  return (
    <Page>
      <ViewHeader eyebrow="Incubation" title={s.startup} subtitle={`Stage: ${s.stage} · Incubation status: ${s.exit_status || 'Active'}`} />
      <StatGrid>
        <StatTile n={1} label="Runway" value={formatKpi('months', s.runway_months)} sub={kpi(data, 'runway').trend || 'Current'} />
        <StatTile n={2} label="Revenue" value={formatINR(s.revenue)} sub={revenue.period ? `Latest quarter · ${revenue.period}` : 'Latest quarter'} />
        <StatTile n={3} label="Capital facilitated" value={formatINR(s.capital_facilitated)} sub="Hub-introduced" />
        <StatTile n={4} label="Compliance" value={formatKpi('pct', s.compliance_pct)} sub={s.compliance_pct >= 90 ? 'On track' : 'Needs attention'} />
      </StatGrid>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHead n={1} title="Current incubation focus" />
          <div className="mt-3">
            <ListRow label="Stage" value={s.stage} />
            <ListRow label="MoU renewal" value={formatDate(s.mou_renewal)} />
            <ListRow label="Jobs created" value={String(s.jobs_created ?? '—')} />
          </div>
        </Card>
        <Card>
          <CardHead n={2} title="Next actions" action={<button type="button" onClick={() => navigate('kpis')} className="text-xs font-semibold text-black/45 hover:text-orange">KPIs →</button>} />
          <div className="mt-3">
            {!data.nextActions.length && <p className="py-3 text-sm text-black/55">Nothing due. You’re all caught up.</p>}
            {data.nextActions.map((a) => (
              <div key={a.label} className="flex items-center justify-between gap-4 border-b border-black/[0.06] py-3 last:border-0">
                <span className="text-sm text-black/65">{a.label}</span>
                {a.date ? <span className="font-mono text-xs font-semibold text-ink">{formatDate(a.date)}</span> : <Pill>{a.status}</Pill>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}

/* ---------------- MoU & Compliance ---------------- */
export function ComplianceView({ data }) {
  return (
    <Page>
      <ViewHeader eyebrow="MoU & Compliance" title={`Compliance at ${formatKpi('pct', data.startup.compliance_pct)}.`} subtitle="Core incubation agreement and compliance records." />
      <motion.div variants={viewItem}>
        <AttendanceMeter presentCount={data.startup.compliance_pct ?? 0} heldCount={100} caption="Quarterly compliance checklist" />
      </motion.div>
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.item}
          rows={data.compliance}
          columns={[
            { key: 'item', label: 'Item', width: '1.4fr' },
            { key: 'status', label: 'Status', width: '160px', render: (r) => <Pill>{r.status}</Pill> },
            { key: 'review', label: 'Review / date', width: '1fr', render: (r) => [r.note, r.review_date && formatDate(r.review_date)].filter(Boolean).join(' · ') || '—' },
          ]}
          empty="No compliance records yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- KPIs ---------------- */
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

function KpiForm({ data, save }) {
  const [period, setPeriod] = useState(data.thisQuarter)
  const [values, setValues] = useState(() => Object.fromEntries(KPI_METRICS.map((m) => [m.id, ''])))
  const [state, setState] = useState(null)
  const filled = KPI_METRICS.filter((m) => values[m.id] !== '')

  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await save('incubation/kpis', { period, values: Object.fromEntries(filled.map((m) => [m.id, Number(values[m.id])])) }, (_, res) => res)
      setValues(Object.fromEntries(KPI_METRICS.map((m) => [m.id, ''])))
      setState({ saved: true })
    } catch (err) {
      setState({ error: err.message })
    }
  }

  return (
    <motion.form variants={viewItem} onSubmit={submit} className="mt-8 rounded-2xl border border-orange/30 bg-orange/[0.04] p-6">
      <CardHead title="Update quarterly KPIs" />
      <p className="mt-2 text-sm text-black/55">Leave a field blank to keep it as is. Saving also refreshes your Overview tiles.</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Quarter" htmlFor="kpi-period">
          <select id="kpi-period" value={period} onChange={(e) => setPeriod(e.target.value)} className={inputClass}>
            {recentQuarters(data.thisQuarter).map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </Field>
        {KPI_METRICS.map((m) => (
          <Field key={m.id} label={`${m.label}${m.unit === 'inr' ? ' (₹)' : m.unit === 'months' ? ' (months)' : m.unit === 'pct' ? ' (%)' : ''}`} htmlFor={`kpi-${m.id}`}>
            <input
              id={`kpi-${m.id}`}
              type="number"
              inputMode="decimal"
              min="0"
              max={m.max}
              step={m.unit === 'months' ? '0.1' : '1'}
              placeholder={kpi(data, m.id).current ?? ''}
              value={values[m.id]}
              onChange={(e) => {
                setValues((v) => ({ ...v, [m.id]: e.target.value }))
                setState(null)
              }}
              className={inputClass}
            />
          </Field>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!filled.length || state?.saving} className={primaryButton}>
          Save {period} KPIs
        </button>
        <SaveNote state={state} />
      </div>
    </motion.form>
  )
}

export function KpisView({ data, save }) {
  return (
    <Page>
      <ViewHeader eyebrow="KPIs" title="Current operating indicators." subtitle="Report each quarter here; the Hub team reviews them at your quarterly advisory." />
      <div className="mt-10">
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
              render: (r) => <span className="font-mono text-xs text-black/55">{r.history.map((h) => `${h.period}: ${formatKpi(r.unit, h.value ?? NaN)}`).join('  →  ') || '—'}</span>,
            },
          ]}
        />
      </div>
      <KpiForm data={data} save={save} />
    </Page>
  )
}

/* ---------------- Funding ---------------- */
export function FundingView({ data }) {
  const total = data.funding.reduce((sum, f) => sum + (f.amount || 0), 0)
  return (
    <Page>
      <ViewHeader eyebrow="Funding" title={`${formatINR(total)} in the pipeline.`} subtitle="Funding opportunities and introductions managed through the Hub." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.source}
          rows={data.funding}
          columns={[
            { key: 'source', label: 'Investor / source', width: '1.4fr' },
            { key: 'stage', label: 'Stage', width: '1fr' },
            { key: 'amount', label: 'Amount', width: '120px', render: (r) => <span className="font-mono font-semibold">{formatINR(r.amount)}</span> },
            { key: 'status', label: 'Status', width: '150px', render: (r) => <Pill>{r.status}</Pill> },
          ]}
          empty="No funding conversations yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- Documents ---------------- */
function UploadForm({ save, onClose }) {
  const [form, setForm] = useState({ doc: '', type: DOC_TYPES[0], link: '' })
  const [state, setState] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await save('incubation/documents', form, (d, r) => ({
        ...d,
        documents: [...d.documents.filter((x) => x.doc.toLowerCase() !== r.doc.toLowerCase()), r],
      }))
      onClose()
    } catch (err) {
      setState({ error: err.message })
    }
  }
  return (
    <motion.form variants={viewItem} initial="hidden" animate="show" onSubmit={submit} className="mt-8 rounded-2xl border border-orange/30 bg-orange/[0.04] p-6">
      <CardHead title="Upload document" />
      <p className="mt-2 text-sm text-black/55">Share it as a link (Google Drive, Docs, or any https URL).</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_160px_1.5fr]">
        <Field label="Document" htmlFor="inc-doc">
          <input id="inc-doc" required maxLength={120} value={form.doc} onChange={set('doc')} className={inputClass} placeholder="e.g. Board resolution" />
        </Field>
        <Field label="Type" htmlFor="inc-type">
          <select id="inc-type" value={form.type} onChange={set('type')} className={inputClass}>
            {DOC_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Link" htmlFor="inc-link">
          <input id="inc-link" type="url" required maxLength={2000} value={form.link} onChange={set('link')} className={inputClass} placeholder="https://" />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state?.saving} className={primaryButton}>
          Submit document
        </button>
        <button type="button" onClick={onClose} className={ghostButton}>
          Cancel
        </button>
        <SaveNote state={state} />
      </div>
    </motion.form>
  )
}

export function DocumentsView({ data, save }) {
  const [uploading, setUploading] = useState(false)
  return (
    <Page>
      <ViewHeader
        eyebrow="Documents"
        title={`${data.documents.length} documents on record.`}
        subtitle="Submitted incubation documents and current records. Read-only items are managed by the Hub."
        action={
          !uploading && (
            <button type="button" onClick={() => setUploading(true)} className={primaryButton}>
              Upload document
            </button>
          )
        }
      />
      {uploading && <UploadForm save={save} onClose={() => setUploading(false)} />}
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.doc}
          rows={data.documents}
          columns={[
            { key: 'doc', label: 'Document', width: '1.4fr' },
            { key: 'type', label: 'Type', width: '1fr' },
            { key: 'status', label: 'Status', width: '140px', render: (r) => <Pill>{r.status}</Pill> },
            { key: 'link', label: 'Link', width: '90px', render: (r) => <LinkOut href={r.link}>View</LinkOut> },
          ]}
          empty="No documents yet. Use Upload document to add one."
        />
      </div>
    </Page>
  )
}

/* ---------------- Schemes / Media & PR / Resources ---------------- */
function SimpleTable({ eyebrow, title, subtitle, rows, columns, rowKey, empty }) {
  return (
    <Page>
      <ViewHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="mt-10">
        <DataTable rows={rows} columns={columns} rowKey={rowKey} empty={empty} />
      </div>
    </Page>
  )
}

export function SchemesView({ data }) {
  return (
    <SimpleTable
      eyebrow="Schemes"
      title="Government & ecosystem schemes."
      subtitle="Schemes relevant to your startup and where each one stands."
      rows={data.schemes}
      rowKey={(r) => r.scheme}
      empty="No schemes mapped yet."
      columns={[
        { key: 'scheme', label: 'Scheme', width: '1.3fr' },
        { key: 'relevance', label: 'Relevance', width: '1fr' },
        { key: 'status', label: 'Status', width: '140px', render: (r) => <Pill>{r.status}</Pill> },
      ]}
    />
  )
}

export function MediaView({ data }) {
  return (
    <SimpleTable
      eyebrow="Media & PR"
      title="Your story, in public."
      subtitle="Approved media, announcements and founder-story assets."
      rows={data.media}
      rowKey={(r) => r.asset}
      empty="No media assets yet."
      columns={[
        { key: 'asset', label: 'Asset', width: '1.3fr' },
        { key: 'type', label: 'Type', width: '1fr' },
        { key: 'status', label: 'Status', width: '140px', render: (r) => <Pill>{r.status}</Pill> },
      ]}
    />
  )
}

export function ResourcesView({ data }) {
  return (
    <SimpleTable
      eyebrow="Resources"
      title="Hub resources for incubated startups."
      subtitle="Templates and guides from the Brevitty team."
      rows={data.resources}
      rowKey={(r) => r.resource}
      empty="No resources published yet."
      columns={[
        { key: 'resource', label: 'Resource', width: '1.4fr' },
        { key: 'format', label: 'Format', width: '100px', render: (r) => <span className="font-mono text-xs">{r.format}</span> },
        { key: 'use', label: 'Use', width: '1fr' },
        { key: 'link', label: 'Link', width: '110px', render: (r) => (r.link ? <LinkOut href={r.link} /> : <span className="text-xs text-black/40">Ask the Hub</span>) },
      ]}
    />
  )
}

/* ---------------- Exit Status ---------------- */
export function ExitView({ data }) {
  const s = data.startup
  return (
    <Page>
      <ViewHeader eyebrow="Exit Status" title={`Incubation status: ${s.exit_status || 'Active'}.`} subtitle="Current incubation status and transition planning." />
      <Card className="mt-10">
        <CardHead title="Indicators" />
        <div className="mt-3">
          <ListRow label="Incubation status" value={s.exit_status} />
          <ListRow label="Exit review" value={s.exit_review} />
          <ListRow label="Transition plan" value={s.transition_plan} />
          <ListRow label="MoU renewal" value={formatDate(s.mou_renewal)} />
        </div>
      </Card>
      {!s.exit_review && <EmptyNote>No exit review scheduled.</EmptyNote>}
    </Page>
  )
}
