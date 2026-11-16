import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { StageRail } from '../junction/dashboard/shared.jsx'
import { ArrowRightIcon, ChevronRightIcon, VideoIcon, ChatIcon } from '../junction/dashboard/icons.jsx'
import { ALL_ITEMS, nextTaskFor, tasksDone, profileReadySeal } from '../../data/launchpadChecklist.js'
import { formatTime } from '../../lib/hubApi.js'
import { Page, StatGrid, StatTile, cardClass, eyebrowClass, viewItem, pad2, ghostButton } from '../hub/ui.jsx'

const viewAllClass = 'inline-flex items-center gap-1 text-xs font-semibold text-black/45 transition-colors hover:text-orange'

function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function dateParts(iso) {
  const d = new Date(`${iso}T00:00:00`)
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
  }
}

export default function OverviewView({ lp }) {
  const { data, phases, current, completeness, profileReady, navigate } = lp
  const firstName = (data.student.name || '').split(/\s+/)[0]
  const doneCount = phases.filter((p) => p.status === 'done').length
  const next = nextTaskFor(phases, data.checked)
  const attended = data.sessions.filter((s) => s.past && s.status === 'completed').length
  const nextSession = data.sessions.find((s) => !s.past && s.status !== 'cancelled')
  const latestFeedback = data.feedback[0]

  return (
    <Page>
      <motion.div variants={viewItem} className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-5">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">
          <span>Build</span>
          <span className="text-black/20">→</span>
          <span>Prove</span>
          <span className="text-black/20">→</span>
          <span>Apply</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-display text-sm italic text-black/40 sm:block">What you build is what they remember.</span>
          {data.isMentor && (
            <Link to="/launchpad/mentor" className={ghostButton}>
              Mentor view →
            </Link>
          )}
        </div>
      </motion.div>

      <motion.div variants={viewItem} className="mt-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          {greetingFor(new Date().getHours())}
          {firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mt-3 text-base text-black/55">
          {current ? `Phase ${current.n} — ${current.label}. ${current.blurb}` : profileReady ? 'Your profile is signed off and ready for applications.' : 'All four phases done. Your mentor signs off next.'}
        </p>
      </motion.div>

      <StatGrid>
        <StatTile n={1} label="Current phase" value={current ? `${current.n} ${current.label}` : profileReady ? 'Ready' : 'Done'} sub={`${doneCount} of ${phases.length} phases complete`} />
        <StatTile n={2} label="Tasks done" value={`${tasksDone(data.checked)} / ${ALL_ITEMS.length}`} sub="Compulsory + optional items" />
        <StatTile n={3} label="Sessions attended" value={pad2(attended)} sub={`${data.sessions.length} sessions on record`} />
        <StatTile n={4} label="Profile completeness" value={`${completeness.pct}%`} sub={`${completeness.filled} of ${completeness.total} fields filled`} />
      </StatGrid>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <motion.div variants={viewItem} className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className={eyebrowClass}>Your journey</span>
            <button type="button" onClick={() => navigate('journey')} className={viewAllClass}>
              Open My Journey
              <span className="h-3 w-3">
                <ChevronRightIcon />
              </span>
            </button>
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-ink">{current ? current.label : 'Profile Ready'}</h2>
          <p className="mt-1 text-sm text-black/55">{current ? current.blurb : 'Four phases, one story admissions officers remember.'}</p>
          <StageRail stages={phases} seal={profileReadySeal(phases, profileReady, data.signoff)} />
        </motion.div>

        <motion.div variants={viewItem} className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0a0a0a] p-6 dark:bg-gradient-to-br dark:from-[#1c1512] dark:to-[#241a12]">
          <div className="pointer-events-none absolute -right-8 -top-8 hidden h-32 w-32 rounded-full bg-orange/20 blur-2xl dark:block" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Next task</span>
              {next && <span className="rounded-full bg-orange px-3 py-1 text-[11px] font-semibold text-[#0a0a0a]">Compulsory</span>}
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold text-white">{next ? next.label : 'Nothing compulsory left.'}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {next ? next.hint : profileReady ? 'Profile Ready. Time to write those applications.' : 'Your mentor reviews your work and signs off Profile Ready.'}
            </p>
          </div>
          <div className="mt-8 flex items-end justify-between">
            <span className="text-xs text-white/40">{next ? `Phase ${current.n} · ${next.phaseLabel}` : 'Launchpad Abroad'}</span>
            <button
              type="button"
              onClick={() => navigate('journey')}
              aria-label="Open My Journey"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange text-[#0a0a0a] transition-transform hover:scale-105"
            >
              <span className="h-4 w-4">
                <ArrowRightIcon />
              </span>
            </button>
          </div>
        </motion.div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <motion.div variants={viewItem} className={cardClass}>
          <span className={eyebrowClass}>Assigned mentor</span>
          {data.mentor ? (
            <div className="mt-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06] font-mono text-xs font-semibold text-black/60">
                {data.mentor.name.split(' ').map((w) => w[0]).join('')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{data.mentor.name}</p>
                <p className="text-xs text-black/50">{data.mentor.expertise}</p>
                <p className="mt-2 text-xs leading-relaxed text-black/55">{data.mentor.bio}</p>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-black/55">No mentor assigned yet.</p>
          )}
        </motion.div>

        <motion.div variants={viewItem} className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={eyebrowClass}>Next session</span>
            <button type="button" onClick={() => navigate('sessions')} className={viewAllClass}>
              View all
              <span className="h-3 w-3">
                <ChevronRightIcon />
              </span>
            </button>
          </div>
          {nextSession ? (
            <div className="mt-5 flex gap-4">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-black/10 bg-[#fafaf8] dark:bg-white/[0.04]">
                <span className="font-mono text-[10px] font-semibold uppercase text-orange">{dateParts(nextSession.date).month}</span>
                <span className="font-display text-xl font-bold text-ink">{dateParts(nextSession.date).day}</span>
                <span className="font-mono text-[9px] uppercase text-black/40">{dateParts(nextSession.date).weekday}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Mentor session</p>
                <p className="mt-1 text-xs text-black/50">{formatTime(nextSession.time)}</p>
                {nextSession.mentor && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-black/50">
                    <span className="h-3.5 w-3.5">
                      <VideoIcon />
                    </span>
                    with {nextSession.mentor}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-black/55">No upcoming session yet. Your mentor schedules the next one.</p>
          )}
        </motion.div>

        <motion.div variants={viewItem} className={cardClass}>
          <span className={eyebrowClass}>Mentor feedback</span>
          {latestFeedback ? (
            <div className="mt-5 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange">
                <span className="h-4 w-4">
                  <ChatIcon />
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-ink">“{latestFeedback.feedback}”</p>
                <p className="mt-1.5 text-xs text-black/45">
                  {latestFeedback.mentor ? `${latestFeedback.mentor} · ` : ''}{new Date(`${latestFeedback.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-black/55">No feedback yet. Notes from your mentor show up here.</p>
          )}
        </motion.div>
      </div>
    </Page>
  )
}
