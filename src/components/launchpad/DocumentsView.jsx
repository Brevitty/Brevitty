import { motion } from 'framer-motion'
import { AttendanceMeter } from '../junction/dashboard/shared.jsx'
import { DOCUMENTS } from '../../data/launchpadChecklist.js'
import { formatDate } from '../../lib/hubApi.js'
import { FILE_HINT } from '../../lib/storage.ts'
import { FileUploadButton, FileLink } from '../hub/FileUpload.jsx'
import { Page, ViewHeader, Pill, ghostButton, viewItem, pad2 } from '../hub/ui.jsx'

const STATUS_LABEL = { pending: 'Pending', submitted: 'Submitted', verified: 'Verified' }

export default function DocumentsView({ lp }) {
  const { data, save } = lp
  const byId = Object.fromEntries(data.documents.map((d) => [d.docId, d]))
  const verified = DOCUMENTS.filter((d) => byId[d.id]?.status === 'verified').length
  const submitted = DOCUMENTS.filter((d) => byId[d.id]?.status === 'submitted').length

  // Returns an error string for FileUploadButton to show, or nothing on success.
  const submit = (docId) => async ({ path }) => {
    try {
      await save('launchpad/documents', { doc_id: docId, file_path: path }, (d, r) => ({
        ...d,
        documents: [...d.documents.filter((x) => x.docId !== r.docId), r],
      }))
    } catch (err) {
      return err.message || 'Could not save the document.'
    }
  }

  return (
    <Page>
      <ViewHeader
        eyebrow="Documents"
        title={`${verified} of ${DOCUMENTS.length} verified.`}
        subtitle={`Upload each document; your mentor verifies it. ${FILE_HINT}.`}
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
                  {row?.link && <FileLink stored={row.link}>View</FileLink>}
                  <Pill tone={status === 'verified' ? 'done' : status === 'submitted' ? 'active' : 'neutral'}>{STATUS_LABEL[status]}</Pill>
                  {status !== 'verified' && (
                    <FileUploadButton
                      target={{ pillar: 'launchpad', docId: doc.id }}
                      label={row?.link ? 'Replace' : 'Upload'}
                      ariaLabel={`${row?.link ? 'Replace' : 'Upload'} ${doc.name}`}
                      className={ghostButton}
                      onUploaded={submit(doc.id)}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </Page>
  )
}
