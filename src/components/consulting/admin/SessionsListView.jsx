import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Tabs, EmptyState, Loaded, SearchInput, viewItem, inputClass } from '../ui.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import { admin } from '../../../lib/consultingApi.js'
import { byDateTime, isUpcoming } from '../../../lib/consultingTime.js'
import SessionRow from './SessionRow.jsx'
import { paths } from './paths.js'

const TABS = ['upcoming', 'completed', 'missing', 'all']

export default function SessionsListView() {
  const load = useLoad(() => Promise.all([admin.sessions(), admin.summary()]).then(([a, b]) => ({ ...a, needs: new Set(b.missing_from_me.map((g) => g.session_id)) })), [])
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [student, setStudent] = useState('')
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'upcoming'

  return (
    <Loaded load={load}>
      {({ sessions, needs }) => {
        const upcoming = sessions.filter((s) => isUpcoming(s)).sort(byDateTime) // soonest first
        const completed = sessions.filter((s) => s.status === 'completed') // API returns newest first
        const missing = sessions.filter((s) => needs.has(s.session_id))
        const people = [...new Map(sessions.map((s) => [s.email, s.consultee_name]))].sort((a, b) => a[1].localeCompare(b[1]))
        const base = ({ upcoming, completed, missing, all: sessions }[tab]).filter((s) => !student || s.email === student)
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
            <motion.div variants={viewItem} className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-full overflow-x-auto">
              <Tabs
                value={tab}
                onChange={(t) => setParams({ tab: t }, { replace: true })}
                tabs={[
                  { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
                  { id: 'completed', label: 'Completed', count: completed.length },
                  { id: 'missing', label: 'Missing info', count: missing.length },
                  { id: 'all', label: 'All', count: sessions.length },
                ]}
              />
              </div>
              <select aria-label="Filter by student" value={student} onChange={(e) => setStudent(e.target.value)} className={`${inputClass} sm:w-52`}>
                <option value="">All students</option>
                {people.map(([email, name]) => (
                  <option key={email} value={email}>
                    {name}
                  </option>
                ))}
              </select>
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
                title={needle ? 'No matches' : tab === 'missing' ? 'Nothing missing' : tab === 'upcoming' ? 'Nothing upcoming' : 'No sessions here yet'}
                body={needle ? 'Try a different name or topic.' : 'Book one from Schedule.'}
              />
            )}
          </Page>
        )
      }}
    </Loaded>
  )
}
