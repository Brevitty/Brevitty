import { useState } from 'react'
import { DOC_SLOTS, OTHER_KIND, docStatus } from '../../data/incubationRules.js'
import { saveDocument } from '../../lib/db.ts'
import { ACCEPT, FILE_HINT } from '../../lib/storage.ts'
import { formatDate } from '../../lib/hubApi.js'
import { FileUploadButton, FileLink, useUpload, UploadProgress, UploadError } from '../hub/FileUpload.jsx'
import { Page, ViewHeader, Card, CardHead, DataTable, Pill, Field, inputClass, primaryButton, ghostButton } from '../hub/ui.jsx'

const TITLE_MAX = 120
const STATUS_TONE = { 'Not uploaded': 'neutral', Submitted: 'active', Verified: 'done' }

// Review / Date column: only the MoU has a renewal; everything else just shows its upload date.
const reviewText = (row) => {
  if (!row.doc) return '—'
  if (row.kind === 'mou') return row.doc.renewal_date ? `Renewal · ${formatDate(row.doc.renewal_date)}` : '—'
  return row.doc.uploaded_at ? `Uploaded · ${formatDate(row.doc.uploaded_at)}` : '—'
}

function AddOtherDocument({ run }) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const { upload, progress, error } = useUpload({ pillar: 'incubation', docId: OTHER_KIND })

  async function submit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const uploaded = await upload(file)
    if (!uploaded) return
    setSaving(true)
    const res = await run(() => saveDocument({ kind: OTHER_KIND, title: title.trim(), file_path: uploaded.path, file_name: uploaded.name }), `“${title.trim()}” added.`)
    setSaving(false)
    if (res) {
      setTitle('')
      setFile(null)
      form.reset()
    }
  }

  const busy = progress !== null || saving
  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_1.2fr_auto] sm:items-end">
      <Field label="Title" htmlFor="doc-title">
        <input id="doc-title" required maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className={inputClass} placeholder="Board resolution" />
      </Field>
      <Field label="File" htmlFor="doc-file">
        <input
          id="doc-file"
          type="file"
          required
          accept={ACCEPT}
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-orange/15 file:px-3 file:py-1 file:text-xs file:font-semibold`}
        />
      </Field>
      <button type="submit" disabled={busy || !title.trim() || !file} className={primaryButton}>
        {progress !== null ? `Uploading ${progress}%` : saving ? 'Saving…' : 'Add document'}
      </button>
      <div className="sm:col-span-3">
        <UploadProgress progress={progress} />
        <UploadError error={error} />
      </div>
    </form>
  )
}

export default function MouDocumentsView({ data, run }) {
  const slotRows = DOC_SLOTS.map((s) => ({ ...s, doc: data.documents.find((d) => d.kind === s.kind) }))
  const otherRows = data.documents.filter((d) => d.kind === OTHER_KIND).map((doc) => ({ kind: OTHER_KIND, title: doc.title, doc }))

  const save = (r) => async ({ path, name }) => {
    const id = r.kind === OTHER_KIND ? r.doc.id : undefined
    await run(() => saveDocument({ kind: r.kind, id, file_path: path, file_name: name }), `${r.title} ${r.doc ? 'replaced' : 'uploaded'}.`)
  }

  const columns = [
    { key: 'title', label: 'Document', width: '1.3fr', render: (r) => <span className="font-semibold">{r.title}</span> },
    { key: 'status', label: 'Status', width: '140px', render: (r) => <Pill tone={STATUS_TONE[docStatus(r.doc)]}>{docStatus(r.doc)}</Pill> },
    { key: 'file', label: 'File', width: '1.1fr', render: (r) => (r.doc ? <FileLink stored={r.doc.file_path}>{r.doc.file_name || 'View'}</FileLink> : '—') },
    { key: 'review', label: 'Review / date', width: '1.1fr', render: (r) => <span className="font-mono text-xs text-black/60">{reviewText(r)}</span> },
    {
      key: 'actions',
      label: 'Actions',
      width: '200px',
      render: (r) => (
        <FileUploadButton
          target={{ pillar: 'incubation', docId: r.kind === OTHER_KIND ? r.doc.id : r.kind }}
          label={r.doc ? 'Replace' : 'Upload'}
          ariaLabel={`${r.doc ? 'Replace' : 'Upload'} ${r.title}`}
          className={r.doc ? ghostButton : `${primaryButton} !min-h-[40px] !px-4`}
          onUploaded={save(r)}
        />
      ),
    },
  ]

  return (
    <Page>
      <ViewHeader eyebrow="MoU & Documents" title="Your agreements and records." subtitle="Upload your MoU and supporting documents. Your MoU renews exactly 3 years after you upload it." />
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-black/40">{FILE_HINT}</p>
      <div className="mt-6">
        <DataTable rowKey={(r) => r.kind} rows={slotRows} columns={columns} />
      </div>

      <Card className="mt-10">
        <CardHead title="Other documents" />
        <AddOtherDocument run={run} />
        <div className="mt-6">
          <DataTable rowKey={(r) => r.doc.id} rows={otherRows} columns={columns} empty="No other documents yet. Add one above." />
        </div>
      </Card>
    </Page>
  )
}
