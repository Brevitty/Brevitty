import { useState } from 'react'
import { motion } from 'framer-motion'
import { AttendanceMeter } from '../junction/dashboard/shared.jsx'
import { DOCUMENTS } from '../../data/launchpadChecklist.js'
import { formatDate } from '../../lib/hubApi.js'
import { Page, ViewHeader, Pill, LinkOut, SaveNote, inputClass, primaryButton, ghostButton, viewItem, pad2 } from '../hub/ui.jsx'

const STATUS_LABEL = { pending: 'Pending', submitted: 'Submitted', verified: 'Verified' }

// Upload = share a link (Drive / Docs / any https URL); the mentor verifies it.
function LinkForm({ doc, current, onSubmit, onCancel }) {
  const [link, setLink] = useState(current?.link || '')
  const [state, setState] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setState({ saving: true })
    try {
      await onSubmit(link.trim())
      onCancel()
    } catch (err) {
      setState({ error: err.message })
    }
  }
  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3 border-t border-black/[0.06] pt-4 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label htmlFor={`doc-${doc.id}`} className="sr-only">
          Link to {doc.name}
        </label>
        <input id={`doc-${doc.id}`} type="url" required maxLength={2000} placeholder="https://drive.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} />
        <SaveNote state={state} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={state?.saving || !link.trim()} className={primaryButton}>
          Submit
        </button>
        <button type="button" onClick={onCancel} className={ghostButton}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function DocumentsView({ lp }) {
  const { data, save } = lp
  const [editing, setEditing] = useState(null)
  const byId = Object.fromEntries(data.documents.map((d) => [d.docId, d]))
  const verified = DOCUMENTS.filter((d) => byId[d.id]?.status === 'verified').length
  const submitted = DOCUMENTS.filter((d) => byId[d.id]?.status === 'submitted').length

  const submit = (docId) => (link) =>
    save('launchpad/documents', { doc_id: docId, link }, (d, r) => ({
      ...d,
      documents: [...d.documents.filter((x) => x.docId !== r.docId), r],
    }))

  return (
    <Page>
      <ViewHeader
        eyebrow="Documents"
        title={`${verified} of ${DOCUMENTS.length} verified.`}
        subtitle="Share each document as a link (Google Drive, Docs, or any https URL). Your mentor verifies it."
      />
      <motion.div variants={viewItem}>
        <AttendanceMeter presentCount={verified} heldCount={DOCUMENTS.length} caption={`${verified} verified · ${submitted} awaiting review · ${DOCUMENTS.length - verified - submitted} pending`} />
      </motion.div>

      <div className="mt-10 flex flex-col gap-3">
        {DOCUMENTS.map((doc, i) => {
          const row = byId[doc.id]
          const status = row?.status || 'pending'
          return (
            <motion.div key={doc.id} variants={viewItem} className="rounded-xl border border-black/10 bg-surface px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex items-start gap-4 sm:w-80 sm:shrink-0">
                  <span className="font-mono text-xs font-semibold text-black/30">[{pad2(i + 1)}]</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{doc.name}</p>
                    <p className="text-xs text-black/45">{doc.hint}</p>
                  </div>
                </div>
                <span className="font-mono text-xs text-black/55 sm:w-28 sm:shrink-0">{row?.submittedDate ? formatDate(row.submittedDate) : '—'}</span>
                <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                  {row?.link && <LinkOut href={row.link}>View</LinkOut>}
                  <Pill tone={status === 'verified' ? 'done' : status === 'submitted' ? 'active' : 'neutral'}>{STATUS_LABEL[status]}</Pill>
                  {status !== 'verified' && editing !== doc.id && (
                    <button type="button" onClick={() => setEditing(doc.id)} className={ghostButton}>
                      {row?.link ? 'Replace link' : 'Add link'}
                    </button>
                  )}
                </div>
              </div>
              {editing === doc.id && <LinkForm doc={doc} current={row} onSubmit={submit(doc.id)} onCancel={() => setEditing(null)} />}
            </motion.div>
          )
        })}
      </div>
    </Page>
  )
}
