import { useState } from 'react'
import { motion } from 'framer-motion'
import { formatINR } from '../../data/incubationRules.js'
import { formatDate } from '../../lib/hubApi.js'
import {
  Page, ViewHeader, StatGrid, StatTile, Card, CardHead, ListRow, DataTable, Pill, LinkOut, Field, SaveNote,
  inputClass, primaryButton, ghostButton, viewItem,
} from '../hub/ui.jsx'

const SUBMITTED = 'Submitted'
const isSubmitted = (r) => r.status.toLowerCase() === SUBMITTED.toLowerCase()
const shortDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')

/* ---------------- Overview ---------------- */
export function OverviewView({ data, navigate }) {
  const { partner, summary, nextActions } = data
  return (
    <Page>
      <ViewHeader eyebrow="Partner Services" title={partner.org_name} subtitle={`${partner.org_type} · MoU ${partner.mou_ref}`} />
      <StatGrid>
        <StatTile n={1} label="Active programs" value={String(summary.activePrograms)} sub={`${summary.programs} linked to the partnership`} />
        <StatTile n={2} label="Funds disbursed" value={formatINR(summary.fundsThisCycle)} sub={summary.cycle ? `This cycle · ${summary.cycle}` : 'No disbursements yet'} />
        <StatTile n={3} label="Reports due" value={String(summary.reportsDue)} sub={summary.nextReportDue ? `Next: ${formatDate(summary.nextReportDue)}` : 'All submitted'} />
        <StatTile n={4} label="Renewals" value={String(summary.renewalsUpcoming)} sub={summary.nextRenewal ? `Upcoming · next ${formatDate(summary.nextRenewal)}` : 'None upcoming'} />
      </StatGrid>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHead n={1} title="Partnership snapshot" />
          <div className="mt-3">
            <ListRow label="Institution" value={partner.org_name} />
            <ListRow label="MoU" value={partner.mou_ref} />
            <ListRow label="Linked startups" value={partner.linked_startups === null ? '—' : String(partner.linked_startups)} />
          </div>
        </Card>
        <Card>
          <CardHead n={2} title="Next actions" action={<button type="button" onClick={() => navigate('reporting')} className="text-xs font-semibold text-black/45 hover:text-orange">Reporting →</button>} />
          <div className="mt-3">
            {!nextActions.length && <p className="py-3 text-sm text-black/55">Nothing due. You’re all caught up.</p>}
            {nextActions.map((a) => (
              <div key={a.label} className="flex items-center justify-between gap-4 border-b border-black/[0.06] py-3 last:border-0">
                <span className="text-sm text-black/65">{a.label}</span>
                {a.overdue ? <Pill tone="warn">{`Overdue · ${shortDate(a.date)}`}</Pill> : <span className="font-mono text-xs font-semibold text-ink">{a.date ? `Due ${formatDate(a.date)}` : '—'}</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}

/* ---------------- Programs ---------------- */
export function ProgramsView({ data }) {
  return (
    <Page>
      <ViewHeader eyebrow="Programs" title={`${data.programs.length} programs linked to the partnership.`} subtitle="Programs your organisation funds or co-runs with the Hub." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.program}
          rows={data.programs}
          columns={[
            { key: 'program', label: 'Program', width: '1.3fr' },
            { key: 'type', label: 'Type', width: '1fr' },
            { key: 'status', label: 'Status', width: '130px', render: (r) => <Pill>{r.status}</Pill> },
            { key: 'participants', label: 'Participants', width: '1fr' },
          ]}
          empty="No programs linked yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- Disbursements ---------------- */
export function DisbursementsView({ data }) {
  return (
    <Page>
      <ViewHeader eyebrow="Disbursements" title={`${formatINR(data.summary.fundsTotal)} disbursed in total.`} subtitle="Funds released for programs run with the Hub." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => `${r.program}-${r.period}`}
          rows={data.disbursements}
          columns={[
            { key: 'program', label: 'Program', width: '1.4fr' },
            { key: 'amount', label: 'Amount', width: '130px', render: (r) => <span className="font-mono font-semibold">{formatINR(r.amount)}</span> },
            { key: 'period', label: 'Period', width: '120px', render: (r) => <span className="font-mono text-xs">{r.period}</span> },
            { key: 'status', label: 'Status', width: '130px', render: (r) => <Pill>{r.status}</Pill> },
          ]}
          empty="No disbursements yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- Reporting ---------------- */
function SubmitReport({ report, onSubmit }) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState(report.link || '')
  const [state, setState] = useState(null)
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {report.link && <LinkOut href={report.link}>View</LinkOut>}
        <button type="button" onClick={() => setOpen(true)} className={ghostButton}>
          {isSubmitted(report) ? 'Replace link' : 'Mark submitted'}
        </button>
      </div>
    )
  }
  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await onSubmit(link.trim())
      setOpen(false)
    } catch (err) {
      setState({ error: err.message })
    }
  }
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2">
      <label htmlFor={`rep-${report.report}-${report.period}`} className="sr-only">
        Link to {report.report}
      </label>
      <input id={`rep-${report.report}-${report.period}`} type="url" required maxLength={2000} placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} />
      <div className="flex gap-2">
        <button type="submit" disabled={state?.saving} className={primaryButton}>
          Submit
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostButton}>
          Cancel
        </button>
      </div>
      <SaveNote state={state} />
    </form>
  )
}

export function ReportingView({ data, save, refetch }) {
  const submit = (r) => async (link) => {
    await save('partner/reports', { report: r.report, period: r.period, link }, (d, res) => ({
      ...d,
      reports: d.reports.map((x) => (x.report === res.report && x.period === res.period ? { ...x, status: res.status, link: res.link } : x)),
    }))
    refetch() // the Overview "reports due" summary is computed server-side
  }
  return (
    <Page>
      <ViewHeader eyebrow="Reporting" title={data.summary.reportsDue ? `${data.summary.reportsDue} report due.` : 'All reports submitted.'} subtitle="Reports shared with the Hub. Mark one submitted by attaching a link (Google Drive, Docs or any https URL)." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => `${r.report}-${r.period}`}
          rows={data.reports}
          columns={[
            { key: 'report', label: 'Report', width: '1.2fr' },
            { key: 'period', label: 'Period', width: '100px', render: (r) => <span className="font-mono text-xs">{r.period}</span> },
            { key: 'status', label: 'Status', width: '140px', render: (r) => <Pill tone={isSubmitted(r) ? 'done' : !r.due_date || r.due_date >= data.today ? 'active' : 'warn'}>{!isSubmitted(r) && r.due_date && r.due_date < data.today ? 'Overdue' : r.status}</Pill> },
            { key: 'due', label: 'Due', width: '120px', render: (r) => <span className="font-mono text-xs">{r.due_date ? formatDate(r.due_date) : '—'}</span> },
            { key: 'action', label: 'Submission', width: '1.2fr', render: (r) => <SubmitReport report={r} onSubmit={submit(r)} /> },
          ]}
          empty="No reports scheduled yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- Events ---------------- */
export function EventsView({ data }) {
  return (
    <Page>
      <ViewHeader eyebrow="Events" title="Partner-linked events." subtitle="Events and engagements run with the Hub." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.event}
          rows={data.events}
          columns={[
            { key: 'date', label: 'Date', width: '140px', render: (r) => <span className="font-mono text-xs">{formatDate(r.date)}</span> },
            { key: 'event', label: 'Event', width: '1.3fr' },
            { key: 'participants', label: 'Participants', width: '1fr' },
            { key: 'status', label: 'Status', width: '120px', render: (r) => <Pill>{r.status}</Pill> },
          ]}
          empty="No events planned yet."
        />
      </div>
    </Page>
  )
}

/* ---------------- Relationship ---------------- */
function ContactForm({ partner, save }) {
  const initial = { contact_name: partner.contact_name, contact_email: partner.contact_email, contact_phone: partner.contact_phone }
  const [form, setForm] = useState(initial)
  const [state, setState] = useState(null)
  const dirty = Object.keys(initial).some((k) => form[k].trim() !== (partner[k] || ''))
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setState(null)
  }
  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await save('partner/contact', Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])), (d, res) => ({ ...d, partner: { ...d.partner, ...res } }))
      setState({ saved: true })
    } catch (err) {
      setState({ error: err.message })
    }
  }
  return (
    <form onSubmit={submit} className="mt-5 space-y-4 border-t border-black/[0.06] pt-5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Primary contact</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="ps-name">
          <input id="ps-name" required maxLength={120} value={form.contact_name} onChange={set('contact_name')} className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="ps-email">
          <input id="ps-email" type="email" required maxLength={254} value={form.contact_email} onChange={set('contact_email')} className={inputClass} />
        </Field>
        <Field label="Phone" htmlFor="ps-phone">
          <input id="ps-phone" type="tel" required maxLength={20} value={form.contact_phone} onChange={set('contact_phone')} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!dirty || state?.saving} className={primaryButton}>
          Save contact
        </button>
        <SaveNote state={state} />
      </div>
    </form>
  )
}

export function RelationshipView({ data, save }) {
  const p = data.partner
  return (
    <Page>
      <ViewHeader eyebrow="Relationship" title="Your partnership, on record." subtitle="Organisation profile and the people who run this partnership." />
      <Card className="mt-10">
        <CardHead n={1} title="Organisation profile" />
        <div className="mt-3 grid grid-cols-1 gap-x-8 lg:grid-cols-2">
          <div>
            <ListRow label="Organisation" value={p.org_name} />
            <ListRow label="Affiliation" value={p.university} />
            <ListRow label="Organisation type" value={p.org_type} />
          </div>
          <div>
            <ListRow label="Authorized representatives" value={p.representatives} />
            <ListRow label="Financial commitment" value={p.financial_commitment} />
            <ListRow label="MoU reference" value={p.mou_ref} />
          </div>
        </div>
        <ContactForm partner={p} save={save} />
      </Card>
      <motion.div variants={viewItem} className="mt-10">
        <DataTable
          rowKey={(r) => r.contact}
          rows={data.contacts}
          columns={[
            { key: 'contact', label: 'Contact', width: '1.1fr' },
            { key: 'role', label: 'Role', width: '1.1fr' },
            { key: 'contact_email', label: 'Email', width: '1.3fr', render: (r) => <a href={`mailto:${r.contact_email}`} className="break-all text-[#c2410c] hover:underline dark:text-orange">{r.contact_email}</a> },
            { key: 'status', label: 'Status', width: '110px', render: (r) => <Pill>{r.status}</Pill> },
          ]}
          empty="No relationship contacts yet."
        />
      </motion.div>
    </Page>
  )
}

/* ---------------- Renewals / MoU ---------------- */
export function RenewalsView({ data }) {
  return (
    <Page>
      <ViewHeader eyebrow="Renewals" title={`${data.summary.renewalsUpcoming} renewals coming up.`} subtitle="Partnership renewals and where each one stands." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.partnership}
          rows={data.renewals}
          columns={[
            { key: 'partnership', label: 'Partnership', width: '1.3fr' },
            { key: 'renewal_date', label: 'Renewal date', width: '150px', render: (r) => <span className="font-mono text-xs">{formatDate(r.renewal_date)}</span> },
            { key: 'status', label: 'Status', width: '150px', render: (r) => <Pill>{r.status}</Pill> },
          ]}
          empty="No renewals on record."
        />
      </div>
    </Page>
  )
}

export function MouView({ data }) {
  return (
    <Page>
      <ViewHeader eyebrow="MoU" title={`MoU ${data.partner.mou_ref}.`} subtitle="Agreement records and institutional documents. The signed agreement is read-only and managed by the Hub." />
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.document}
          rows={data.mou}
          columns={[
            { key: 'document', label: 'Document', width: '1.3fr' },
            { key: 'reference', label: 'Reference', width: '1fr', render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
            { key: 'status', label: 'Status', width: '140px', render: (r) => <Pill tone={r.status.toLowerCase() === 'read-only' ? 'neutral' : undefined}>{r.status}</Pill> },
          ]}
          empty="No agreement records yet."
        />
      </div>
    </Page>
  )
}
