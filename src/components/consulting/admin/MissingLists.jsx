// Sir's Today view: "Missing from students" and "Missing from me". Both come from the same
// rules the student Home uses (api/_lib/consulting/missing.js), computed in the summary API.
import { Link } from 'react-router-dom'
import { Section, Card, EmptyState } from '../ui.jsx'
import { fmtDate } from '../../../lib/consultingTime.js'
import { paths } from './paths.js'

const KIND_LABEL = { mom: 'Minutes', deliverable: 'Deliverable', task: 'Overdue task', tasks: 'Tasks', deliverables: 'Deliverables' }

function GroupedList({ groups, byStudent }) {
  // Students: one block per student with their sessions underneath. Me: a flat list of sessions.
  const blocks = byStudent
    ? Object.values(
        groups.reduce((acc, g) => {
          ;(acc[g.email] ??= { name: g.consultee_name, sessions: [] }).sessions.push(g)
          return acc
        }, {})
      )
    : [{ name: '', sessions: groups }]
  return (
    <Card className="divide-y divide-black/[0.06]">
      {blocks.map((b) => (
        <div key={b.name || 'me'} className="px-5 py-4">
          {b.name && <p className="font-display text-base font-bold text-ink">{b.name}</p>}
          <ul className="space-y-3">
            {b.sessions.map((g) => (
              <li key={g.session_id} className={b.name ? 'mt-2' : ''}>
                <Link to={paths.session(g.session_id)} className="block rounded-lg hover:bg-black/[0.02]">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-black/45">
                    {byStudent ? '' : `${g.consultee_name} · `}
                    {fmtDate(g.date)} · {g.topic || 'Session'}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {g.items.map((i, n) => (
                      <span key={`${i.kind}-${i.id ?? n}`} className="rounded-full border border-orange/30 bg-orange/10 px-2.5 py-0.5 text-xs font-medium text-[#9a3412]">
                        {KIND_LABEL[i.kind]}
                        {i.label && (i.kind === 'deliverable' || i.kind === 'task') ? `: ${i.label}` : ''}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  )
}

export default function MissingLists({ fromStudents, fromMe, n }) {
  return (
    <div className="grid gap-x-6 lg:grid-cols-2">
      <Section n={n} title="Waiting on students" meta={`${fromStudents.length} session${fromStudents.length === 1 ? '' : 's'}`}>
        {fromStudents.length ? (
          <div data-testid="missing-from-students">
            <GroupedList groups={fromStudents} byStudent />
          </div>
        ) : (
          <EmptyState mark="OK" title="Nothing missing" body="Every student is caught up." />
        )}
      </Section>
      <Section n={n + 1} title="Needs attention" meta={`${fromMe.length} session${fromMe.length === 1 ? '' : 's'}`}>
        {fromMe.length ? (
          <div data-testid="missing-from-me">
            <GroupedList groups={fromMe} />
          </div>
        ) : (
          <EmptyState mark="OK" title="Nothing missing" body="Every finished session has its minutes, tasks and deliverables (or is marked as needing none)." />
        )}
      </Section>
    </div>
  )
}
