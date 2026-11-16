import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { REVENUE_TARGET, itemIsDone } from '../../../../data/journeyData.js'
import { useJunctionData } from '../../../../lib/junctionData.js'
import { ease } from '../motionVariants.js'
import { CheckIcon } from '../icons.jsx'

const cardClass = 'rounded-2xl border border-black/10 bg-surface p-6 transition-colors duration-500'
const eyebrowClass = 'font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45'
// A student whose StartupProfiles row the program team hasn't filled in yet.
const EMPTY_PROFILE = {}
const NOT_SET = 'Not added yet'
const currency = (n) => `₹${n.toLocaleString('en-IN')}`

function StageRail({ stages, selectedStageId, onSelect }) {
  const doneCount = stages.filter((s) => s.status === 'done').length
  const progress = (doneCount + 0.5) / stages.length

  return (
    <div className="relative mt-10">
      <div className="absolute left-0 right-0 top-[15px] hidden h-px bg-black/10 lg:block" />
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: progress }}
        transition={{ duration: 0.8, ease, delay: 0.15 }}
        style={{ transformOrigin: 'left' }}
        className="absolute left-0 right-0 top-[15px] hidden h-px bg-orange lg:block"
      />
      <div className="absolute left-[15px] top-1 bottom-1 w-px bg-black/10 lg:hidden" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7 lg:gap-2">
        {stages.map((stage) => {
          const isSelected = stage.id === selectedStageId
          const isLocked = stage.status === 'locked'
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelect(stage.id)}
              className="group relative flex items-center gap-4 pl-0 text-left lg:flex-col lg:items-center lg:text-center"
            >
              <span
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[10px] font-semibold transition-colors lg:mx-auto ${
                  stage.status === 'done'
                    ? 'border-orange bg-orange text-white'
                    : stage.status === 'current'
                    ? 'border-orange bg-surface text-orange dark:shadow-[0_0_12px_0_rgba(249,115,22,0.45)]'
                    : 'border-black/15 bg-surface text-black/35'
                } ${isSelected ? 'ring-2 ring-orange/30 ring-offset-2' : ''}`}
              >
                {stage.status === 'done' && (
                  <span className="h-3.5 w-3.5">
                    <CheckIcon />
                  </span>
                )}
              </span>
              <div className="lg:mt-3">
                <p className={`text-sm font-semibold ${isSelected ? 'text-orange' : isLocked ? 'text-black/40' : 'text-ink'}`}>
                  {stage.label}
                </p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-black/40">
                  {stage.status === 'done'
                    ? 'Complete'
                    : stage.status === 'current'
                    ? `${stage.completion.doneCount}/${stage.completion.totalCount} required`
                    : 'Locked'}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// links: { template, example } from the ItemResources tab; the buttons only exist when the sheet has a URL.
function DeliverableRow({ item, links, done, disabled, highlighted, onToggle }) {
  return (
    <div
      id={`journey-item-${item.id}`}
      className={`flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4 transition-colors ${
        highlighted ? 'border-orange/50 bg-orange/5' : 'border-black/10 bg-surface'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={disabled || item.computed}
          onClick={() => onToggle(item.id)}
          aria-label={done ? `Mark ${item.label} as not done` : `Mark ${item.label} as done`}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
            done ? 'border-orange bg-orange text-white' : 'border-black/20 bg-surface text-transparent'
          } ${disabled ? 'cursor-not-allowed opacity-50' : item.computed ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <span className="h-3 w-3">
            <CheckIcon />
          </span>
        </button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{item.label}</p>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide ${
                item.required
                  ? 'border-orange/30 bg-orange/10 text-[#c2410c] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60'
                  : 'border-black/10 bg-black/[0.03] text-black/50'
              }`}
            >
              {item.required ? 'Compulsory' : 'Optional'}
            </span>
            {item.computed && (
              <span className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-black/50">
                Auto-tracked
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-black/50">{item.hint}</p>
        </div>
      </div>

      {(links?.template || links?.example) && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {links.template && (
            <a href={links.template} target="_blank" rel="noreferrer" className="text-xs font-semibold text-orange transition-opacity hover:opacity-70">
              Open template ↗
            </a>
          )}
          {links.example && (
            <a href={links.example} target="_blank" rel="noreferrer" className="text-xs font-semibold text-black/50 transition-colors hover:text-orange">
              See an example ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// A plain-text brief built from the student's own StartupProfiles row; nothing leaves the browser.
function downloadBrief(profile, ledgerTotal, stageLabel) {
  const lines = [
    profile.startupName || 'Your startup',
    profile.oneLiner || '',
    '',
    `Stage: ${stageLabel}`,
    `Revenue logged: ${currency(ledgerTotal)}`,
    `Customer interviews run: ${profile.interviewsRun ?? 0}`,
    '',
    ...[['Problem', profile.problem], ['Solution', profile.solution], ['Product', profile.product], ['Description', profile.description]].flatMap(([k, v]) => [k.toUpperCase(), v || NOT_SET, '']),
  ]
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${(profile.startupName || 'startup').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-brief.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function OnePager({ ledgerTotal, currentStageLabel }) {
  const profile = useJunctionData().profile || EMPTY_PROFILE
  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className={eyebrowClass}>One-pager</span>
        <button
          type="button"
          onClick={() => downloadBrief(profile, ledgerTotal, currentStageLabel)}
          className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-orange/50 hover:text-orange"
        >
          Download brief
        </button>
      </div>

      <h3 className="mt-4 font-display text-2xl font-bold text-ink">{profile.startupName || 'Your startup'}</h3>
      <p className="mt-1 text-sm italic text-black/55">{profile.oneLiner || NOT_SET}</p>

      <dl className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Problem</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-black/65">{profile.problem || NOT_SET}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Solution</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-black/65">{profile.solution || NOT_SET}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Product</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-black/65">{profile.product || NOT_SET}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Description</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-black/65">{profile.description || NOT_SET}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-black/[0.06] pt-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/40">Current stage</p>
          <p className="mt-1 text-sm font-semibold text-ink">{currentStageLabel}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/40">Revenue to date</p>
          <p className="mt-1 text-sm font-semibold text-ink">{currency(ledgerTotal)}</p>
        </div>
      </div>
    </div>
  )
}

function Traction({ ledgerTotal }) {
  const { profile, invoices } = useJunctionData()
  const stats = [
    { label: 'Revenue to date', value: currency(ledgerTotal) },
    { label: 'Interviews run', value: profile?.interviewsRun ?? 0 },
    { label: 'Invoices logged', value: invoices.length },
  ]
  return (
    <div className={cardClass}>
      <span className={eyebrowClass}>Traction</span>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="font-display text-2xl font-bold text-ink">{s.value}</p>
            <p className="mt-1 text-xs text-black/50">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-black/[0.06] pt-4">
        <div className="flex items-center justify-between text-xs text-black/50">
          <span>Toward first ₹{REVENUE_TARGET.toLocaleString('en-IN')}</span>
          <span>{Math.min(100, Math.round((ledgerTotal / REVENUE_TARGET) * 100))}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full bg-orange transition-all duration-700"
            style={{ width: `${Math.min(100, (ledgerTotal / REVENUE_TARGET) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function MyStartupView({ stages, checklistState, onToggleItem, ledgerTotal, hasVerifiedCompetition, jumpTarget }) {
  const { resources = {} } = useJunctionData() // ItemResources: template / example links per journey item
  const currentStage = stages.find((s) => s.status === 'current') || stages[stages.length - 1]
  const [selectedStageId, setSelectedStageId] = useState(currentStage.id)
  const [highlightId, setHighlightId] = useState(null)

  useEffect(() => {
    if (!jumpTarget) return
    setSelectedStageId(jumpTarget.stageId)
    setHighlightId(jumpTarget.itemId)
    const el = document.getElementById(`journey-item-${jumpTarget.itemId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setHighlightId(null), 2400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTarget?.token])

  const selectedStage = stages.find((s) => s.id === selectedStageId) || currentStage
  const isLocked = selectedStage.status === 'locked'
  const mainDeliverables = useMemo(() => selectedStage.deliverables.filter((d) => d.group !== 'legal'), [selectedStage])
  const legalDeliverables = useMemo(() => selectedStage.deliverables.filter((d) => d.group === 'legal'), [selectedStage])

  return (
    <div>
      <StageRail stages={stages} selectedStageId={selectedStageId} onSelect={setSelectedStageId} />

      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={eyebrowClass}>{selectedStage.label}</span>
            <h3 className="mt-2 font-display text-xl font-bold text-ink">
              {selectedStage.completion.doneCount} of {selectedStage.completion.totalCount} compulsory items done
            </h3>
          </div>
        </div>

        {isLocked && (
          <p className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black/55">
            Complete every compulsory item in the stage before this one to unlock it. You can preview what's ahead below.
          </p>
        )}

        <div className="mt-5 space-y-3">
          {mainDeliverables.map((item) => (
            <DeliverableRow
              key={item.id}
              item={item}
              links={resources[item.id]}
              done={itemIsDone(item, checklistState, ledgerTotal, hasVerifiedCompetition)}
              disabled={isLocked}
              highlighted={highlightId === item.id}
              onToggle={onToggleItem}
            />
          ))}
        </div>

        {legalDeliverables.length > 0 && (
          <div className="mt-8">
            <p className={eyebrowClass}>Legal — optional, carried forward</p>
            <div className="mt-4 space-y-3">
              {legalDeliverables.map((item) => (
                <DeliverableRow
                  key={item.id}
                  item={item}
                  links={resources[item.id]}
                  done={!!checklistState[item.id]}
                  disabled={isLocked}
                  highlighted={highlightId === item.id}
                  onToggle={onToggleItem}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <OnePager ledgerTotal={ledgerTotal} currentStageLabel={currentStage.label} />
        <Traction ledgerTotal={ledgerTotal} />
      </div>
    </div>
  )
}

