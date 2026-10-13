import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StageRail, TabBar } from '../junction/dashboard/shared.jsx'
import { ease } from '../junction/dashboard/motionVariants.js'
import { CheckIcon } from '../junction/dashboard/icons.jsx'
import { PROFILE_SECTIONS, profileReadySeal, allPhasesDone } from '../../data/launchpadChecklist.js'
import { Page, ViewHeader, Pill, cardClass, eyebrowClass, viewItem, EmptyNote } from '../hub/ui.jsx'
import SectionForm from './SectionForm.jsx'

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'startup', label: 'My Startup' },
  { id: 'community', label: 'Community' },
]
const STATUS_LABEL = { done: 'Complete', current: 'In progress', locked: 'Locked' }
const STARTUP_SECTION = PROFILE_SECTIONS.find((s) => s.id === 'startup')

export default function JourneyView({ lp }) {
  const [tab, setTab] = useState('home')
  const [phaseId, setPhaseId] = useState(lp.current?.id || lp.phases.at(-1).id)
  const openPhase = (id) => {
    setPhaseId(id)
    setTab('startup')
  }

  return (
    <Page>
      <motion.div variants={viewItem} className="flex flex-wrap items-end justify-between gap-4">
        <ViewHeader eyebrow="My journey" title="Four phases. One story worth telling." />
        <TabBar tabs={TABS} active={tab} onChange={setTab} layoutId="lp-journey-tab" />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease }} className="mt-10">
          {tab === 'home' && <JourneyHome lp={lp} onOpenPhase={openPhase} />}
          {tab === 'startup' && <MyStartup lp={lp} phaseId={phaseId} onPhase={setPhaseId} />}
          {tab === 'community' && <Community lp={lp} />}
        </motion.div>
      </AnimatePresence>
    </Page>
  )
}

function JourneyHome({ lp, onOpenPhase }) {
  const { phases, profileReady, data } = lp
  const allDone = allPhasesDone(phases)
  return (
    <div>
      <div className={cardClass}>
        <span className={eyebrowClass}>Your path</span>
        <StageRail stages={phases} seal={profileReadySeal(phases, profileReady, data.signoff)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {phases.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpenPhase(p.id)}
            className={`group rounded-2xl border p-6 text-left transition-colors ${
              p.status === 'current' ? 'border-orange/50 bg-orange/[0.04]' : 'border-black/10 bg-surface hover:border-orange/40'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`font-mono text-xs font-semibold ${p.status === 'locked' ? 'text-black/30' : 'text-orange'}`}>[{p.n}]</span>
              <Pill tone={p.status === 'done' ? 'done' : p.status === 'current' ? 'active' : 'neutral'}>{STATUS_LABEL[p.status]}</Pill>
            </div>
            <h3 className={`mt-4 font-display text-xl font-bold ${p.status === 'locked' ? 'text-black/45' : 'text-ink'}`}>{p.label}</h3>
            <p className="mt-1 text-sm text-black/55">{p.blurb}</p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-black/40">
              {p.completion.doneCount} of {p.completion.totalCount} compulsory · open checklist →
            </p>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-[#0a0a0a] p-6 text-white dark:bg-gradient-to-br dark:from-[#1c1512] dark:to-[#241a12]">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">End state · Profile Ready</span>
        <h3 className="mt-3 font-display text-2xl font-bold">
          {profileReady ? 'Signed off. Your profile is ready for applications.' : allDone ? 'All four phases done. Waiting for the Launchpad team’s sign-off.' : 'Unlocks when Phase 4 is complete and the Launchpad team signs off.'}
        </h3>
        {profileReady && data.signoff && (
          <p className="mt-2 text-sm text-white/55">
            Signed by {data.signoff.signedBy} on {new Date(`${data.signoff.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  )
}

function ChecklistRow({ item, done, disabled, busy, onToggle }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${done ? 'border-orange/30 bg-orange/[0.04]' : 'border-black/10 bg-surface'}`}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onToggle}
        aria-label={done ? `Mark "${item.label}" as not done` : `Mark "${item.label}" as done`}
        aria-pressed={done}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
          done ? 'border-orange bg-orange text-white' : 'border-black/20 bg-surface text-transparent'
        } ${disabled ? 'cursor-not-allowed opacity-50' : busy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
      >
        <span className="h-3 w-3">
          <CheckIcon />
        </span>
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">{item.label}</p>
          <Pill tone={item.required ? 'active' : 'neutral'}>{item.required ? 'Compulsory' : 'Optional'}</Pill>
        </div>
        <p className="mt-1 text-xs text-black/50">{item.hint}</p>
      </div>
    </div>
  )
}

function MyStartup({ lp, phaseId, onPhase }) {
  const { phases, data, save, saveField } = lp
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const phase = phases.find((p) => p.id === phaseId)
  const locked = phase.status === 'locked'

  async function toggle(item) {
    setBusyId(item.id)
    setError('')
    try {
      await save('launchpad/checklist', { item_id: item.id, checked: !data.checked[item.id] }, (d, r) => {
        const checked = { ...d.checked }
        if (r.checked) checked[r.item_id] = true
        else delete checked[r.item_id]
        return { ...d, checked }
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <TabBar tabs={phases.map((p) => ({ id: p.id, label: `${p.n} ${p.label}` }))} active={phaseId} onChange={onPhase} layoutId="lp-phase-tab" />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className={eyebrowClass}>Phase {phase.n}</span>
          <h3 className="mt-2 font-display text-xl font-bold text-ink">
            {phase.completion.doneCount} of {phase.completion.totalCount} compulsory items done
          </h3>
        </div>
        <Pill tone={phase.status === 'done' ? 'done' : phase.status === 'current' ? 'active' : 'neutral'}>{STATUS_LABEL[phase.status]}</Pill>
      </div>
      {locked && (
        <p className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black/55">
          Finish every compulsory item in the phase before this one to unlock it. You can preview what’s ahead.
        </p>
      )}
      <p className="mt-3 text-xs text-black/45">Ticks only. Files and links go in Documents.</p>
      <div className="mt-5 space-y-3">
        {phase.items.map((item) => (
          <ChecklistRow key={item.id} item={item} done={Boolean(data.checked[item.id])} disabled={locked} busy={busyId === item.id} onToggle={() => toggle(item)} />
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

      <div className={`${cardClass} mt-10`}>
        <span className={eyebrowClass}>Startup one-pager</span>
        <p className="mt-2 text-sm text-black/55">This feeds the Startup summary on your Profile.</p>
        <div className="mt-6">
          <SectionForm section={STARTUP_SECTION} profile={data.profile} onSaveField={saveField} />
        </div>
      </div>
    </div>
  )
}

function Community({ lp }) {
  const people = lp.data.community
  if (!people.length) return <EmptyNote>No other Launchpad Abroad startups to show yet.</EmptyNote>
  return (
    <div>
      <p className="text-sm text-black/55">Other Launchpad Abroad students building alongside you.</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((c, i) => (
          <motion.div key={`${c.firstName}-${c.startup}`} variants={viewItem} initial="hidden" animate="show" className={cardClass}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-black/30">[{String(i + 1).padStart(2, '0')}]</span>
              <Pill tone="neutral">{c.phase}</Pill>
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-ink">{c.startup}</h3>
            <p className="mt-1 text-sm text-black/60">{c.oneLiner}</p>
            <p className="mt-4 text-xs text-black/45">
              {c.firstName} · Grade {c.grade} · {c.school}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
