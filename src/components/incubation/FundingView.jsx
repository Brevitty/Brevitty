import { useState } from 'react'
import { motion } from 'framer-motion'
import { FUNDING_STATUSES, FUNDING_TYPES, formatINR } from '../../data/incubationRules.js'
import { saveFunding, deleteFunding } from '../../lib/db.ts'
import { ACCEPT, FILE_HINT } from '../../lib/storage.ts'
import { formatDate } from '../../lib/hubApi.js'
import { useUpload, UploadProgress, UploadError, FileLink } from '../hub/FileUpload.jsx'
import { Page, ViewHeader, CardHead, DataTable, Pill, Field, inputClass, primaryButton, ghostButton, viewItem } from '../hub/ui.jsx'

const FUNDER_MAX = 120
const NOTES_MAX = 500
const STATUS_TONE = { Received: 'done', Pending: 'active', Applied: 'neutral' }

const blank = (today) => ({ id: undefined, funder: '', type: FUNDING_TYPES[0], amount: '', date: today, status: FUNDING_STATUSES[0], notes: '' })

function FundingForm({ initial, existingFile, run, onClose }) {
  const [form, setForm] = useState(initial)
  const [proof, setProof] = useState(null)
  const [saving, setSaving] = useState(false)
  const { upload, progress, error } = useUpload({ pillar: 'incubation', docId: 'funding' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const editing = Boolean(form.id)

  async function submit(e) {
    e.preventDefault()
    const uploaded = proof ? await upload(proof) : null
    if (proof && !uploaded) return
    setSaving(true)
    const file = uploaded ? { file_path: uploaded.path, file_name: uploaded.name } : {}
    const res = await run(() => saveFunding({ ...form, ...file }), editing ? 'Funding record updated.' : 'Funding record added.')
    setSaving(false)
    if (res) onClose()
  }
  const busy = saving || progress !== null

  return (
    <motion.form variants={viewItem} initial="hidden" animate="show" onSubmit={submit} className="mt-8 rounded-2xl border border-orange/30 bg-orange/[0.04] p-6">
      <CardHead title={editing ? 'Edit funding record' : 'Add funding record'} />
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Funder / source" htmlFor="fund-funder">
          <input id="fund-funder" required maxLength={FUNDER_MAX} value={form.funder} onChange={set('funder')} disabled={busy} className={inputClass} />
        </Field>
        <Field label="Type" htmlFor="fund-type">
          <select id="fund-type" value={form.type} onChange={set('type')} disabled={busy} className={inputClass}>
            {FUNDING_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount (₹)" htmlFor="fund-amount">
          <input id="fund-amount" type="number" inputMode="decimal" required min="0" step="any" value={form.amount} onChange={set('amount')} disabled={busy} className={inputClass} />
        </Field>
        <Field label="Date received" htmlFor="fund-date">
          <input id="fund-date" type="date" required value={form.date} onChange={set('date')} disabled={busy} className={inputClass} />
        </Field>
        <Field label="Status" htmlFor="fund-status">
          <select id="fund-status" value={form.status} onChange={set('status')} disabled={busy} className={inputClass}>
            {FUNDING_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Proof document (optional)" htmlFor="fund-proof" hint={existingFile ? `Current: ${existingFile}. Choose a file to replace it.` : FILE_HINT}>
          <input
            id="fund-proof"
            type="file"
            accept={ACCEPT}
            disabled={busy}
            onChange={(e) => setProof(e.target.files?.[0] || null)}
            className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-orange/15 file:px-3 file:py-1 file:text-xs file:font-semibold`}
          />
          <UploadProgress progress={progress} />
          <UploadError error={error} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Notes (optional)" htmlFor="fund-notes">
            <textarea id="fund-notes" rows={2} maxLength={NOTES_MAX} value={form.notes} onChange={set('notes')} disabled={busy} className={inputClass} />
          </Field>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          {progress !== null ? `Uploading ${progress}%` : saving ? 'Saving…' : editing ? 'Save changes' : 'Add record'}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className={ghostButton}>
          Cancel
        </button>
      </div>
    </motion.form>
  )
}

export default function FundingView({ data, run }) {
  const [form, setForm] = useState(null) // null = closed, else the record being added/edited
  const [confirmId, setConfirmId] = useState('')
  const [busy, setBusy] = useState('')

  async function remove(f) {
    setBusy(f.id)
    await run(() => deleteFunding(f.id), 'Funding record deleted.')
    setBusy('')
    setConfirmId('')
  }

  const editing = form?.id ? data.funding.find((f) => f.id === form.id) : null
  return (
    <Page>
      <ViewHeader
        eyebrow="Funding"
        title={`${formatINR(data.fundingReceived)} received.`}
        subtitle="Record the funding your startup has received or applied for."
        action={
          !form && (
            <button type="button" onClick={() => setForm(blank(data.today))} className={primaryButton}>
              Add funding
            </button>
          )
        }
      />
      {form && <FundingForm key={form.id || 'new'} initial={form} existingFile={editing?.file_name} run={run} onClose={() => setForm(null)} />}
      <div className="mt-10">
        <DataTable
          rowKey={(r) => r.id}
          rows={data.funding}
          empty="No funding recorded yet."
          columns={[
            {
              key: 'funder',
              label: 'Funder',
              width: '1.4fr',
              render: (r) => (
                <>
                  <span className="font-semibold">{r.funder}</span>
                  {r.notes && <span className="mt-0.5 block text-xs text-black/50">{r.notes}</span>}
                </>
              ),
            },
            { key: 'type', label: 'Type', width: '90px' },
            { key: 'amount', label: 'Amount', width: '110px', render: (r) => <span className="font-mono font-semibold">{formatINR(r.amount)}</span> },
            { key: 'date', label: 'Date', width: '120px', render: (r) => formatDate(r.date) || '—' },
            { key: 'status', label: 'Status', width: '110px', render: (r) => <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill> },
            {
              key: 'actions',
              label: 'Actions',
              width: '250px',
              render: (r) => (
                <div className="flex flex-wrap gap-2">
                  {r.file_path && (
                    <FileLink stored={r.file_path} className={ghostButton}>
                      Proof
                    </FileLink>
                  )}
                  <button
                    type="button"
                    aria-label={`Edit ${r.funder}`}
                    disabled={Boolean(busy)}
                    onClick={() => setForm({ ...blank(data.today), id: r.id, funder: r.funder, type: r.type, amount: String(r.amount ?? ''), date: r.date, status: r.status, notes: r.notes })}
                    className={ghostButton}
                  >
                    Edit
                  </button>
                  {confirmId === r.id ? (
                    <>
                      <button type="button" disabled={Boolean(busy)} onClick={() => remove(r)} className={`${ghostButton} !border-red-400 !text-red-600`}>
                        {busy === r.id ? 'Deleting…' : 'Confirm'}
                      </button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => setConfirmId('')} className={ghostButton}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" aria-label={`Delete ${r.funder}`} disabled={Boolean(busy)} onClick={() => setConfirmId(r.id)} className={ghostButton}>
                      Delete
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </Page>
  )
}
