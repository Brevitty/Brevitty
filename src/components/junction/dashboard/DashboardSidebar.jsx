import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ease } from './motionVariants.js'
import BackToWorkspace from '../../hub/BackToWorkspace.jsx'
import { ChevronRightIcon, GearIcon, SignOutIcon, SunIcon, MoonIcon } from './icons.jsx'

function initialsOf(name) {
  const words = (name || '?').trim().split(/\s+/)
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0]?.slice(0, 1) || '?').toUpperCase()
}

function iconChipClass(active) {
  return `flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-2 ${
    active ? 'bg-orange text-white' : 'bg-black/[0.04] text-black/40'
  }`
}

const navRowClass = (active) =>
  `group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
    active ? 'bg-orange/10' : 'hover:bg-black/[0.04]'
  }`

const accountRowClass =
  'flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-black/55 transition-colors hover:bg-black/[0.04] hover:text-orange'

// The one deliberate motion moment: the toggle itself, not scattered hover fades.
function ThemeIcon({ isDark }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={isDark ? 'sun' : 'moon'}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.35, ease }}
        className="h-4 w-4"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </motion.span>
    </AnimatePresence>
  )
}

function CohortMiniCard({ student, milestones, subtitle, milestoneNoun }) {
  const completed = milestones.filter((m) => m.status === 'complete').length
  const pct = Math.round((completed / milestones.length) * 100)

  return (
    <button
      type="button"
      className="group w-full rounded-2xl border border-black/10 bg-surface p-4 text-left transition-colors hover:border-orange/40"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-base font-bold text-ink">{student.teamName}</p>
        <span className="h-4 w-4 text-black/30 transition-colors group-hover:text-orange">
          <ChevronRightIcon />
        </span>
      </div>
      <p className="mt-0.5 text-xs text-black/45">{subtitle}</p>
      <div className="mt-3 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: pct / 100 }}
            transition={{ duration: 0.8, ease, delay: 0.2 }}
            style={{ transformOrigin: 'left' }}
            className="h-full rounded-full bg-orange"
          />
        </div>
        <span className="font-mono text-xs font-semibold text-ink">{pct}%</span>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-black/40">
        {completed} of {milestones.length} {milestoneNoun}
      </p>
    </button>
  )
}

/* ---------------- Desktop sidebar ---------------- */
export default function DashboardSidebar({
  navItems,
  activeView,
  onNavigate,
  student,
  milestones,
  email,
  onChangePassword,
  onSignOut,
  isDark,
  onToggleDark,
  // Other Hub workspaces reuse this sidebar; the defaults are Startup Junction's own copy.
  workspaceLabel = 'Startup Junction',
  cardSubtitle = 'Cohort 2026',
  milestoneNoun = 'milestones',
  // Path of the My workspace page; when set, a back button sits under the wordmark.
  backTo,
}) {
  return (
    <aside className="hidden h-screen w-72 shrink-0 flex-col justify-between overflow-y-auto border-r border-black/10 bg-[#fafaf8] dark:bg-surface transition-colors duration-500 lg:flex">
      <div>
        <div className="border-b border-black/10 px-6 py-6">
          <span className="font-display text-xl font-bold tracking-tight text-ink">
            brevitty<span className="text-orange">.</span>
          </span>
          <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">
            {workspaceLabel}
          </p>
          {backTo && <BackToWorkspace to={backTo} className="mt-4" />}
        </div>

        <nav className="px-3 py-6">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = item.id === activeView
              const Icon = item.icon
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => onNavigate(item.id)} className={navRowClass(active)}>
                    <span className={iconChipClass(active)}>
                      <Icon />
                    </span>
                    <span className={`text-sm font-semibold ${active ? 'text-orange' : 'text-black/65 group-hover:text-ink'}`}>
                      {item.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      <div className="space-y-4 border-t border-black/10 p-4">
        {milestones?.length > 0 && (
          <CohortMiniCard student={student} milestones={milestones} subtitle={cardSubtitle} milestoneNoun={milestoneNoun} />
        )}

        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] font-mono text-[11px] font-semibold text-white">
            {initialsOf(student.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{student.name}</p>
            <p className="truncate text-xs text-black/45">{email}</p>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={onToggleDark} className={accountRowClass}>
            <ThemeIcon isDark={isDark} />
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" onClick={onChangePassword} className={accountRowClass}>
            <span className="h-4 w-4">
              <GearIcon />
            </span>
            Settings
          </button>
          <button type="button" onClick={onSignOut} className={accountRowClass}>
            <span className="h-4 w-4">
              <SignOutIcon />
            </span>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}

/* ---------------- Mobile bottom tab bar ---------------- */
export function DashboardMobileNav({
  navItems,
  activeView,
  onNavigate,
  student,
  email,
  onChangePassword,
  onSignOut,
  isDark,
  onToggleDark,
  backTo,
}) {
  const [accountOpen, setAccountOpen] = useState(false)

  return (
    <>
      {/* fixed wrapper holds the fade so it stays pinned to the screen edge while
          the nav underneath scrolls; nav itself is no longer fixed */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <nav className="flex items-stretch overflow-x-auto border-t border-black/10 bg-surface/95 backdrop-blur-md">
          {backTo && (
            <Link
              to={backTo}
              className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-black/10 py-2 outline-none focus-visible:bg-orange/10"
            >
              <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center font-mono text-base leading-none text-black/45">←</span>
              <span className="text-center font-mono text-[9px] font-semibold uppercase leading-tight tracking-[0.06em] text-black/55">My<br />workspace</span>
            </Link>
          )}
          {navItems.map((item) => {
            const active = item.id === activeView
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAccountOpen(false)
                  onNavigate(item.id)
                }}
                className="flex min-w-[62px] flex-1 flex-col items-center gap-1 py-2.5"
              >
                <span className={`h-5 w-5 ${active ? 'text-orange' : 'text-black/35'}`}>
                  <Icon />
                </span>
                <span className={`text-[10px] font-medium ${active ? 'text-ink' : 'text-black/50'}`}>{item.label}</span>
                {active && <span className="mt-0.5 h-1 w-1 rounded-full bg-orange" />}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setAccountOpen((o) => !o)}
            className="flex min-w-[62px] flex-1 flex-col items-center gap-0.5 py-2.5"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[9px] font-semibold ${
                accountOpen ? 'bg-orange text-white' : 'bg-[#0a0a0a] text-white'
              }`}
            >
              {initialsOf(student.name)}
            </span>
            <span className={`text-[10px] font-medium ${accountOpen ? 'text-ink' : 'text-black/50'}`}>Account</span>
          </button>
        </nav>

        {/* Trailing-edge scroll hint: 8 items don't fit at phone widths, and the bar
            gave no sign it scrolls. Static fade + arrow, not scroll-position-aware
            (always shown on phone widths even on the rare one wide enough to fit
            all 8 unscrolled) — ponytail: cut for simplicity, upgrade to a scroll
            listener that hides it at scrollLeft===scrollWidth-clientWidth if that
            false-positive ever bothers users. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 top-px flex w-9 items-center justify-end bg-gradient-to-l from-white/95 via-white/80 to-transparent pr-1 dark:from-[#171310]/95 dark:via-[#171310]/80"
        >
          <span className="text-sm font-semibold text-orange">›</span>
        </div>
      </div>

      <AnimatePresence>
        {accountOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close account menu"
              onClick={() => setAccountOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[#000000]/20 lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.35, ease }}
              className="fixed inset-x-0 bottom-[64px] z-40 rounded-t-2xl border-t border-black/10 bg-surface p-5 lg:hidden"
            >
              <p className="truncate text-sm font-semibold text-ink">{student.name}</p>
              <p className="truncate text-xs text-black/45">{email}</p>
              <div className="mt-4 flex flex-col gap-1 border-t border-black/[0.06] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false)
                    onToggleDark()
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-black/60 hover:text-orange"
                >
                  <ThemeIcon isDark={isDark} />
                  {isDark ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false)
                    onChangePassword()
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-black/60 hover:text-orange"
                >
                  <span className="h-4 w-4">
                    <GearIcon />
                  </span>
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false)
                    onSignOut()
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-black/60 hover:text-orange"
                >
                  <span className="h-4 w-4">
                    <SignOutIcon />
                  </span>
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
