import { useState } from 'react'
import { motion } from 'framer-motion'
import { Page, PageHeader, Section, Card, EmptyState, viewItem, labelClass } from '../ui.jsx'
import { DeliverableItem, SavedBanner } from './parts.jsx'
import { inputBlockedReason } from '../../../lib/consultingTime.js'

function DeliverableList({ rows, submitDeliverable }) {
  return (
    <Card className="px-5 py-5">
      <ul className="divide-y divide-black/[0.06]">
        {rows.map(({ d, session }) => (
          <DeliverableItem key={d.deliverable_id} d={d} session={session} blocked={Boolean(inputBlockedReason(session))} onSubmit={submitDeliverable} />
        ))}
      </ul>
    </Card>
  )
}

// Every deliverable from every session: "To submit" (pending) and "Submitted" (with the link and note inline).
export default function DeliverablesView({ sessions, submitDeliverable: submit }) {
  const [banner, setBanner] = useState('')
  const submitDeliverable = async (d, filePath, note) => {
    await submit(d, filePath, note)
    setBanner(`${d.status === 'pending' ? 'Submitted' : 'Updated'}: ${d.title}`)
  }
  const rows = sessions
    .filter((s) => s.status !== 'cancelled')
    .flatMap((s) => s.deliverables.map((d) => ({ d, session: s })))
    .sort((a, b) => a.session.date.localeCompare(b.session.date))
  const toSubmit = rows.filter((r) => r.d.status === 'pending')
  const submitted = rows.filter((r) => r.d.status !== 'pending').reverse()

  return (
    <Page>
      <PageHeader
        n={4}
        eyebrow="Deliverables"
        title="What you hand in"
        subtitle="Everything sir asked for, across all sessions. Paste a link to a Drive file, doc, deck or sheet to submit."
        action={<span className={labelClass}>{rows.length} total</span>}
      />
      <SavedBanner message={banner} />
      {!rows.length ? (
        <motion.div variants={viewItem} className="mt-8">
          <EmptyState mark="00" title="Nothing to hand in" body="Deliverables your consultant asks for will appear here." />
        </motion.div>
      ) : (
        <>
          <Section n={1} title="To submit" meta={`${toSubmit.length} pending`}>
            {toSubmit.length ? (
              <DeliverableList rows={toSubmit} submitDeliverable={submitDeliverable} />
            ) : (
              <EmptyState mark="OK" title="All handed in" body="Nothing is waiting on you." />
            )}
          </Section>
          <Section n={2} title="Submitted" meta={`${submitted.length} submitted`}>
            {submitted.length ? (
              <DeliverableList rows={submitted} submitDeliverable={submitDeliverable} />
            ) : (
              <EmptyState mark="--" title="Nothing submitted yet" body="Once you submit a link it shows up here." />
            )}
          </Section>
        </>
      )}
    </Page>
  )
}
