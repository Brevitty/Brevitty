// Dashboard pieces shared by Startup Junction and the other Hub workspaces (Launchpad Abroad,
// Incubation, VAC Learner). Moved here verbatim from OverviewView / AttendanceView / JourneyView;
// the new props all default to Startup Junction's original behaviour.
import { motion } from 'framer-motion'
import { ease } from './motionVariants.js'
import { CheckIcon } from './icons.jsx'

// Static class strings (Tailwind can't see dynamic ones). 7 = Startup Junction's original grid.
const RAIL_GRID = {
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-5',
  7: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7',
}

// Stages use the status vocab 'done' | 'current' | 'locked'. `seal` adds an end node that is
// not a stage (Launchpad's "Profile Ready"): { label, unlocked, caption }.
export function StageRail({ stages, seal = null }) {
  const nodes = stages.length + (seal ? 1 : 0)
  const completedCount = stages.filter((s) => s.status === 'done').length
  const currentIndex = stages.findIndex((s) => s.status === 'current')
  const progress = seal?.unlocked ? 1 : currentIndex === -1 ? completedCount / nodes : (currentIndex + 0.5) / nodes

  return (
    <div className="relative mt-8">
      <div className="absolute left-0 right-0 top-[13px] h-px bg-black/10" />
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: progress }}
        transition={{ duration: 0.8, ease, delay: 0.2 }}
        style={{ transformOrigin: 'left' }}
        className="absolute left-0 right-0 top-[13px] h-px bg-orange"
      />
      <div className={`relative grid gap-y-6 ${RAIL_GRID[nodes] || RAIL_GRID[7]}`}>
        {stages.map((s) => {
          const done = s.status === 'done' || s.status === 'current'
          return (
            <div key={s.id} className="flex flex-col items-center text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                  done ? 'border-orange bg-orange text-white' : 'border-black/15 bg-surface text-black/30'
                }`}
              >
                <span className="h-3.5 w-3.5">
                  <CheckIcon />
                </span>
              </span>
              <p className="mt-3 text-xs font-semibold text-ink">{s.label}</p>
              <p
                className={`mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
                  s.status === 'current' ? 'text-orange' : 'text-black/40'
                }`}
              >
                {s.status === 'done' ? 'Complete' : s.status === 'current' ? 'In progress' : 'Upcoming'}
              </p>
            </div>
          )
        })}
        {seal && <SealNode {...seal} />}
      </div>
    </div>
  )
}

// A stamped end-state: dashed ring while locked, solid ink seal with an orange star once earned.
function SealNode({ label, unlocked, caption }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={`relative flex h-7 w-7 items-center justify-center rounded-full ${
          unlocked
            ? 'bg-[#0a0a0a] text-orange shadow-[0_0_0_3px_rgba(249,115,22,0.35)] dark:bg-orange dark:text-white'
            : 'border-2 border-dashed border-black/20 bg-surface text-black/25'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.6 6.1 6.6.5-5 4.4 1.5 6.5L12 16.6 6.3 20l1.5-6.5-5-4.4 6.6-.5z" />
        </svg>
      </span>
      <p className="mt-3 text-xs font-semibold text-ink">{label}</p>
      <p className={`mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${unlocked ? 'text-orange' : 'text-black/40'}`}>
        {caption}
      </p>
    </div>
  )
}

// `caption` / `emptyText` default to the attendance copy; other meters (profile completeness,
// VAC attendance) pass their own.
export function AttendanceMeter({ presentCount, heldCount, caption, emptyText, className = 'mt-6 max-w-md' }) {
  if (heldCount === 0) {
    return (
      <p className={`${className} text-sm text-black/55`}>
        {emptyText || 'No sessions have been held yet — your attendance rate will show up here once the first one happens.'}
      </p>
    )
  }
  const pct = Math.round((presentCount / heldCount) * 100)
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: pct / 100 }}
            transition={{ duration: 0.8, ease, delay: 0.2 }}
            style={{ transformOrigin: 'left' }}
            className="h-full rounded-full bg-orange"
          />
        </div>
        <span className="font-mono text-sm font-semibold text-ink">{pct}%</span>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-black/40">
        {caption || `${presentCount} of ${heldCount} sessions attended`}
      </p>
    </div>
  )
}

// The pill tab bar from My Journey. `layoutId` must be unique per bar on screen.
export function TabBar({ tabs, active, onChange, layoutId = 'journey-tab-pill' }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-full border border-black/10 bg-black/[0.03] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`relative shrink-0 rounded-full px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
            active === tab.id ? 'text-white' : 'text-black/50 hover:text-ink'
          }`}
        >
          {active === tab.id && (
            <motion.span layoutId={layoutId} transition={{ duration: 0.35, ease }} className="absolute inset-0 rounded-full bg-[#0a0a0a]" />
          )}
          <span className="relative">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
