import { JOURNEY_STUDENT, itemIsDone } from '../../../../data/journeyData.js'
import { ArrowRightIcon } from '../icons.jsx'

const cardClass = 'rounded-2xl border border-black/10 bg-surface p-6 transition-colors duration-500'
const eyebrowClass = 'font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45'

export default function JourneyHome({ stages, checklistState, ledgerTotal, hasVerifiedCompetition, onGoToItem, onNavigateTab, firstName }) {
  const currentStage = stages.find((s) => s.status === 'current') || stages[stages.length - 1]
  const dueNow = currentStage.deliverables.filter(
    (d) => d.required && !itemIsDone(d, checklistState, ledgerTotal, hasVerifiedCompetition)
  )
  const pct = currentStage.completion.totalCount
    ? Math.round((currentStage.completion.doneCount / currentStage.completion.totalCount) * 100)
    : 0
  const greetingName = firstName ? `${firstName}, ` : ''

  return (
    <div>
      <div className={cardClass}>
        <span className={eyebrowClass}>Welcome back</span>
        <h3 className="mt-3 font-display text-2xl font-bold text-ink">
          {greetingName}{JOURNEY_STUDENT.startupName} is in {currentStage.label}.
        </h3>
        <p className="mt-2 text-sm text-black/55">{JOURNEY_STUDENT.oneLiner}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-2">
        <div className={cardClass}>
          <span className={eyebrowClass}>Current stage</span>
          <p className="mt-3 font-display text-2xl font-bold text-ink">{currentStage.label}</p>
        </div>
        <div className={cardClass}>
          <span className={eyebrowClass}>Stage checklist</span>
          <p className="mt-3 font-display text-2xl font-bold text-ink">{pct}% done</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full bg-orange transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className={eyebrowClass}>Due now</span>
          <button type="button" onClick={() => onNavigateTab('startup')} className="text-xs font-semibold text-black/45 transition-colors hover:text-orange">
            Open My Startup
          </button>
        </div>

        {dueNow.length === 0 ? (
          <p className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-4 text-sm text-black/55">
            Nothing compulsory left open in this stage. Nice work.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {dueNow.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onGoToItem(currentStage.id, item.id)}
                className="group flex w-full items-center justify-between gap-4 rounded-xl border border-black/10 bg-surface p-4 text-left transition-colors hover:border-orange/50"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="mt-1 text-xs text-black/50">{item.hint}</p>
                </div>
                <span className="h-4 w-4 shrink-0 text-black/30 transition-colors group-hover:text-orange">
                  <ArrowRightIcon />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
