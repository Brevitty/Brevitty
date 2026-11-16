import { motion } from 'framer-motion'
import { viewContainer, viewItem } from './motionVariants.js'
import { StageRail } from './shared.jsx'
import { useAssignedMentors } from '../../../lib/useAssignedMentors.js'
import { useJunctionData } from '../../../lib/junctionData.js'
import {
  getInvoiceTotal,
  getStagesWithStatus,
  hasVerifiedCompetitionEntry,
  itemIsDone,
} from '../../../data/journeyData.js'
import {
  BellIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  CheckIcon,
  CalendarIcon,
  VideoIcon,
  FileIcon,
  BookIcon,
  UsersIcon,
  CalendarCheckIcon,
  ChatIcon,
  MountainClimberIllustration,
} from './icons.jsx'

function formatShortDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMonthDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
  }
}

const cardClass = 'rounded-2xl border border-black/10 bg-surface p-6 transition-colors duration-500'
const eyebrowClass = 'font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/35'
const viewAllClass =
  'inline-flex items-center gap-1 text-xs font-semibold text-black/45 transition-colors hover:text-orange'

const ACTIVITY_STYLE = {
  document: { icon: FileIcon, className: 'bg-orange/10 text-orange' },
  complete: { icon: CheckIcon, className: 'bg-emerald-500 text-white' },
  session: { icon: CalendarIcon, className: 'bg-black/[0.05] text-black/45' },
  feedback: { icon: ChatIcon, className: 'bg-black/[0.05] text-black/45' },
}

const QUICK_ACCESS = [
  { id: 'documents', icon: FileIcon, title: 'Documents', subtitle: 'Upload, manage, share' },
  { id: 'toolkit', icon: BookIcon, title: 'Toolkit', subtitle: 'Templates, guides, resources' },
  { id: 'mentors', icon: UsersIcon, title: 'Mentors', subtitle: 'Your assigned mentors' },
  { id: 'sessions', icon: CalendarCheckIcon, title: 'Sessions', subtitle: 'Upcoming & past sessions' },
]

function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening' // 17:00-20:59 explicitly, and everything else (21:00-04:59) falls back to the same copy
}

export default function OverviewView({ firstName, sessions, activity, onNavigate, onUnauthorized }) {
  const { mentors } = useAssignedMentors(onUnauthorized)
  const { invoices, checklist, competitions } = useJunctionData()
  const { checklistState } = checklist

  const ledgerTotal = getInvoiceTotal(invoices)
  const verifiedCompetition = hasVerifiedCompetitionEntry(competitions)
  const stages = getStagesWithStatus(checklistState, ledgerTotal, verifiedCompetition)
  const currentStage = stages.find((s) => s.status === 'current') || stages[stages.length - 1]
  const completedCount = stages.filter((s) => s.status === 'done').length
  const progressPct = Math.round((completedCount / stages.length) * 100)
  const dueNow = currentStage.deliverables.filter(
    (d) => d.required && !itemIsDone(d, checklistState, ledgerTotal, verifiedCompetition)
  )
  const nextActionItem = dueNow[0] || null

  const greeting = greetingFor(new Date().getHours())
  const nextSession = sessions.find((s) => s.status === 'upcoming')

  const mentorStatus = (mentor) => {
    const upcoming = sessions.find((s) => s.status === 'upcoming' && s.mentor === mentor.name)
    return upcoming
      ? { dot: 'bg-orange', label: `Next session · ${formatShortDate(upcoming.date)}` }
      : { dot: 'bg-emerald-500', label: 'Available this week' }
  }

  const sessionDate = nextSession ? formatMonthDay(nextSession.date) : null

  return (
    <motion.div variants={viewContainer} initial="hidden" animate="show" className="p-6 lg:p-10">
      {/* top bar */}
      <motion.div variants={viewItem} className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-5">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">
          <span>Ideas</span>
          <span className="text-black/20">→</span>
          <span>People</span>
          <span className="text-black/20">→</span>
          <span>Progress</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-display text-sm italic text-black/40 sm:block">Build today. A brighter tomorrow.</span>
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/55">
            <span className="h-4 w-4">
              <BellIcon />
            </span>
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange" />
          </span>
        </div>
      </motion.div>

      {/* hero */}
      <motion.div variants={viewItem} className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {greeting}{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="mt-3 text-base text-black/55">Keep building. You’re making progress.</p>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <div className="max-w-[170px] text-right">
            <p className="font-display text-base italic leading-snug text-ink">“Small steps build big companies.”</p>
          </div>
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full shadow-[0_20px_45px_-15px_rgba(249,115,22,0.55)]">
            <MountainClimberIllustration />
          </div>
        </div>
      </motion.div>

      {/* journey + next action */}
      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <motion.div variants={viewItem} className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className={eyebrowClass}>Your journey</span>
            <div className="text-right">
              <span className="text-sm text-black/55">
                {completedCount} of {stages.length} stages complete
              </span>
              <span className="ml-3 font-display text-2xl font-bold text-ink">{progressPct}%</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-ink">{currentStage.label}</h2>
              <p className="mt-1 text-sm text-black/55">Turn your idea into a validated MVP.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('journey')}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-orange/50 hover:text-orange"
            >
              View details
              <span className="h-3.5 w-3.5">
                <ArrowRightIcon />
              </span>
            </button>
          </div>

          <StageRail stages={stages} />
        </motion.div>

        <motion.div
          variants={viewItem}
          className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0a0a0a] p-6 dark:bg-gradient-to-br dark:from-[#1c1512] dark:to-[#241a12] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
        >
          {/* dark-mode-only depth glow — the one card meant to outrank the others */}
          <div className="pointer-events-none absolute -right-8 -top-8 hidden h-32 w-32 rounded-full bg-orange/20 blur-2xl dark:block" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 dark:text-orange-soft">
                Next action
              </span>
              <span className="rounded-full bg-orange px-3 py-1 text-[11px] font-semibold text-white">Priority</span>
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold text-white">
              {nextActionItem ? nextActionItem.label : 'All caught up for this stage.'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {nextActionItem ? nextActionItem.hint : 'Nothing compulsory left open right now — nice work.'}
            </p>
          </div>
          <div className="mt-8 flex items-end justify-between">
            <span className="text-xs text-white/40">{currentStage.label}</span>
            <button
              type="button"
              onClick={() => onNavigate('journey')}
              aria-label="Open My Journey"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange text-white transition-transform hover:scale-105"
            >
              <span className="h-4 w-4">
                <ArrowRightIcon />
              </span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* mentors / next session / activity */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <motion.div variants={viewItem} className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={eyebrowClass}>Your mentors</span>
            <button type="button" onClick={() => onNavigate('mentors')} className={viewAllClass}>
              View all
              <span className="h-3 w-3">
                <ChevronRightIcon />
              </span>
            </button>
          </div>
          <div className="mt-5 space-y-5">
            {!mentors.length && <p className="text-sm text-black/55">No mentor assigned yet.</p>}
            {mentors.map((m) => {
              const status = mentorStatus(m)
              return (
                <div key={m.mentor_id} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06] font-mono text-xs font-semibold text-black/60">
                    {m.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{m.name}</p>
                    <p className="truncate text-xs text-black/50">{m.expertise}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      <span className="text-[11px] text-black/50">{status.label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        <motion.div variants={viewItem} className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={eyebrowClass}>Next session</span>
            <button type="button" onClick={() => onNavigate('sessions')} className={viewAllClass}>
              View all
              <span className="h-3 w-3">
                <ChevronRightIcon />
              </span>
            </button>
          </div>
          {nextSession ? (
            <div className="mt-5 flex gap-4">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-black/10 bg-[#fafaf8] dark:bg-white/[0.04]">
                <span className="font-mono text-[10px] font-semibold uppercase text-orange">{sessionDate.month}</span>
                <span className="font-display text-xl font-bold text-ink">{sessionDate.day}</span>
                <span className="font-mono text-[9px] uppercase text-black/40">{sessionDate.weekday}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{nextSession.topic}</p>
                <p className="mt-1 text-xs text-black/50">{nextSession.time}</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-black/50">
                  <span className="h-3.5 w-3.5">
                    <VideoIcon />
                  </span>
                  {nextSession.platform}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-black/55">No upcoming sessions scheduled.</p>
          )}
          <button
            type="button"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/10 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-orange/50 hover:text-orange"
          >
            <span className="h-4 w-4">
              <CalendarIcon />
            </span>
            Add to calendar
          </button>
        </motion.div>

        <motion.div variants={viewItem} className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={eyebrowClass}>Recent activity</span>
          </div>
          <div className="mt-5 space-y-4">
            {!activity.length && <p className="text-sm text-black/55">Nothing yet. Updates from the program team show up here.</p>}
            {activity.map((a) => {
              const style = ACTIVITY_STYLE[a.kind]
              const Icon = style.icon
              return (
                <div key={a.id} className="flex items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.className}`}>
                    <span className="h-4 w-4">
                      <Icon />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-black/45">
                      {a.actor} · {a.time}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* quick access */}
      <motion.div variants={viewItem} className="mt-5">
        <div className="flex items-center justify-between">
          <span className={eyebrowClass}>Quick access</span>
          <span className="hidden text-xs text-black/40 sm:block">Everything you need, in one place.</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACCESS.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => onNavigate(q.id)}
              className="group flex items-center gap-3 rounded-2xl border border-black/10 bg-surface p-5 text-left transition-colors hover:border-orange/50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
                <span className="h-5 w-5">
                  <q.icon />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{q.title}</p>
                <p className="truncate text-xs text-black/50">{q.subtitle}</p>
              </div>
              <span className="h-4 w-4 shrink-0 text-black/30 transition-colors group-hover:text-orange">
                <ArrowRightIcon />
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* footer strip */}
      <motion.div variants={viewItem} className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-6">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">
          Learn . Build . Connect . Launch
        </p>
        <div className="text-right">
          <p className="text-xs text-black/40">A community for what’s next</p>
          <div className="mt-2 ml-auto h-px w-24 bg-orange" />
        </div>
      </motion.div>
    </motion.div>
  )
}
