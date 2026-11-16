import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Page, PageHeader, Button, EmptyState, Loaded, SearchInput, viewItem, labelClass, pad2 } from '../ui.jsx'
import { ChevronRightIcon } from '../../junction/dashboard/icons.jsx'
import { useLoad } from '../../../lib/useLoad.js'
import { admin } from '../../../lib/consultingApi.js'
import { fmtDate } from '../../../lib/consultingTime.js'
import AddConsulteeForm from './AddConsulteeForm.jsx'
import { paths } from './paths.js'

const COLUMNS = ['Name', 'Department', 'Course', 'Sem', 'Official email', 'Startup', 'Phone', 'Sessions', 'Last session']

function ConsulteeRow({ c, index }) {
  const academic = [c.department, c.course, c.sem && `Sem ${c.sem}`].filter(Boolean).join(' · ')
  return (
    <Link
      to={paths.consultee(c.email)}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-black/[0.06] px-5 py-4 outline-none last:border-0 hover:bg-orange/[0.03] focus-visible:bg-orange/[0.05] md:grid-cols-[auto_1.3fr_1fr_auto_auto_auto]"
    >
      <span className="font-mono text-[11px] font-semibold text-black/30">[{pad2(index + 1)}]</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
        <span className="block truncate text-xs text-black/50">{c.startup_name || c.email}</span>
      </span>
      <span className="hidden truncate text-xs text-black/55 md:block">{academic || '—'}</span>
      <span className="hidden text-right md:block">
        <span className="block font-mono text-sm font-semibold tabular-nums text-ink">{pad2(c.session_count)}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-black/40">sessions</span>
      </span>
      <span className="hidden w-28 text-right md:block">
        <span className="block font-mono text-[11px] text-ink">{c.next_session_date ? fmtDate(c.next_session_date) : '—'}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-black/40">next</span>
      </span>
      <span className="h-5 w-5 text-black/25 group-hover:text-orange">
        <ChevronRightIcon />
      </span>
    </Link>
  )
}

export default function ConsulteesView() {
  const load = useLoad(admin.consultees, [])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const adding = params.get('new') === '1'
  const setAdding = (on) => setParams(on ? { new: '1' } : {}, { replace: true })

  return (
    <Loaded load={load}>
      {({ consultees }) => {
        const needle = q.trim().toLowerCase()
        const shown = [...consultees]
          .sort((a, b) => a.name.localeCompare(b.name))
          .filter((c) => !needle || `${c.name} ${c.email} ${c.startup_name} ${c.department} ${c.course} ${c.phone}`.toLowerCase().includes(needle))
        return (
          <Page>
            <PageHeader
              n={2}
              eyebrow="Students"
              title="Your students"
              subtitle="Everyone you consult. Open a profile for their full timeline."
              action={
                !adding && (
                  <Button onClick={() => setAdding(true)}>+ Add student</Button>
                )
              }
            />
            {adding && <AddConsulteeForm onCreated={load.reload} onClose={() => setAdding(false)} />}

            <motion.div variants={viewItem} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="sm:w-80">
                <SearchInput value={q} onChange={setQ} placeholder="Search name, email, startup, phone" />
              </div>
              <span className={labelClass}>
                {shown.length} of {consultees.length}
              </span>
            </motion.div>

            <motion.div variants={viewItem} className="mt-4">
              {shown.length ? (
                <>
                  <div className="overflow-hidden rounded-2xl border border-black/10 bg-white md:hidden">
                    {shown.map((c, i) => (
                      <ConsulteeRow key={c.email} c={c} index={i} />
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto rounded-2xl border border-black/10 bg-white md:block">
                    <table className="w-full min-w-[960px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-black/10">
                          {COLUMNS.map((h) => (
                            <th key={h} scope="col" className={`${labelClass} px-4 py-3`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((c) => (
                          <tr key={c.email} onClick={() => navigate(paths.consultee(c.email))} className="cursor-pointer border-b border-black/[0.06] last:border-0 hover:bg-orange/[0.03]">
                            <td className="px-4 py-3 font-semibold text-ink">
                              <Link to={paths.consultee(c.email)} onClick={(e) => e.stopPropagation()} className="hover:underline">
                                {c.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-black/65">{c.department || '—'}</td>
                            <td className="px-4 py-3 text-black/65">{c.course || '—'}</td>
                            <td className="px-4 py-3 font-mono text-black/65">{c.sem || '—'}</td>
                            <td className="px-4 py-3 text-black/65">{c.email}</td>
                            <td className="px-4 py-3 text-black/65">{c.startup_name || '—'}</td>
                            <td className="px-4 py-3 font-mono text-xs text-black/65">{c.phone || '—'}</td>
                            <td className="px-4 py-3 font-mono font-semibold tabular-nums text-ink">{pad2(c.session_count)}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-black/65">{c.last_session_date ? fmtDate(c.last_session_date) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyState
                  mark="00"
                  title={needle ? 'No matches' : 'No students yet'}
                  body={needle ? 'Try a different name, email or startup.' : 'Add your first student to create their login.'}
                  action={!needle && !adding && <Button onClick={() => setAdding(true)}>+ Add student</Button>}
                />
              )}
            </motion.div>
          </Page>
        )
      }}
    </Loaded>
  )
}
