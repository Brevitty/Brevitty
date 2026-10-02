import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Tabs, EmptyState, Loaded, SearchInput, viewItem } from '../ui.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import { admin } from '../../../lib/consultingApi.js'
import { byDateTime, isUpcoming } from '../../../lib/consultingTime.js'
import SessionRow from './SessionRow.jsx'
import { paths } from './paths.js'

const TABS = ['upcoming', 'past', 'all']

export default function SessionsListView() {
  const load = useLoad(() => admin.sessions(), [])
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'upcoming'

  return (
    <Loaded load={load}>
      {({ sessions }) => {
        const upcoming = sessions.filter((s) => isUpcoming(s)).sort(byDateTime) // soonest first
        const past = sessions.filter((s) => !isUpcoming(s)) // API returns newest first
        const base = tab === 'upcoming' ? upcoming : tab === 'past' ? past : sessions
        const needle = q.trim().toLowerCase()
        const shown = needle
          ? base.filter((s) => `${s.consultee_name} ${s.email} ${s.topic} ${s.status}`.toLowerCase().includes(needle))
          : base
        return (
          <Page>
            <PageHeader
              n={4}
              eyebrow="Sessions"
              title="Every session"
              subtitle="Open one to write the minutes, set tasks and deliverables, or reschedule."
              action={
                <Link to={paths.schedule()} className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-black/80">
                  + New session
                </Link>
              }
            />
            <motion.div variants={viewItem} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs
                value={tab}
                onChange={(t) => setParams({ tab: t }, { replace: true })}
                tabs={[
                  { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
                  { id: 'past', label: 'Past', count: past.length },
                  { id: 'all', label: 'All', count: sessions.length },
                ]}
              />
              <div className="sm:w-72">
                <SearchInput value={q} onChange={setQ} placeholder="Search name, topic, status" />
              </div>
            </motion.div>
            <div className="mt-6 space-y-3">
              {shown.map((s) => (
                <SessionRow key={s.session_id} session={s} />
              ))}
            </div>
            {!shown.length && (
              <EmptyState
                mark="00"
                title={needle ? 'No matches' : tab === 'upcoming' ? 'Nothing upcoming' : 'No sessions here yet'}
                body={needle ? 'Try a different name or topic.' : 'Book one from Schedule.'}
              />
            )}
          </Page>
        )
      }}
    </Loaded>
  )
}
