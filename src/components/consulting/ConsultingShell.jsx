// App shell for both consulting surfaces: persistent ink sidebar on desktop,
// top bar + bottom tab bar on mobile. Nav is real routes (NavLink), so every
// view is deep-linkable and the back button works.
import { NavLink } from 'react-router-dom'
import { SignOutIcon } from '../junction/dashboard/icons.jsx'
import { pad2 } from './ui.jsx'
import BackToWorkspace from '../hub/BackToWorkspace.jsx'

function initialsOf(name) {
  const w = (name || '?').trim().split(/\s+/)
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase()
}

function Wordmark({ surface }) {
  return (
    <div>
      <span className="font-display text-xl font-bold tracking-tight text-white">
        brevitty<span className="text-orange">.</span>
      </span>
      <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Consulting · {surface}</p>
    </div>
  )
}

export default function ConsultingShell({ surface, nav, account, onSignOut, children }) {
  return (
    <div className="min-h-screen bg-[#fafaf8] text-ink lg:flex">
      {/* ---------- desktop sidebar ---------- */}
      {/* column carries the ink so it runs the full page height; the sidebar inside stays pinned */}
      <div className="hidden w-72 shrink-0 bg-ink lg:block">
      <aside className="sticky top-0 flex h-screen w-72 flex-col justify-between overflow-y-auto text-white">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-72 bg-[radial-gradient(80%_40%_at_0%_100%,rgba(249,115,22,0.18),transparent_70%)]" />
        <div className="relative">
          <div className="border-b border-white/10 px-7 py-7">
            <Wordmark surface={surface} />
            <BackToWorkspace tone="ink" className="mt-4" />
          </div>
          <nav aria-label={`${surface} sections`} className="px-4 py-6">
            <ul className="space-y-1">
              {nav.map((item, i) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `group flex items-center gap-4 rounded-xl px-3 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange ${
                        isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`font-mono text-[11px] font-semibold ${isActive ? 'text-orange' : 'text-white/30'}`}>[{pad2(i + 1)}]</span>
                        <span className={`h-[18px] w-[18px] ${isActive ? 'text-orange' : 'text-white/40 group-hover:text-white/70'}`}>
                          <item.icon />
                        </span>
                        <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>{item.label}</span>
                        {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange" />}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="relative border-t border-white/10 p-4">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange font-mono text-[11px] font-bold text-ink">
              {initialsOf(account.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{account.name}</p>
              <p className="truncate text-xs text-white/45">{account.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-white/55 outline-none transition-colors hover:bg-white/[0.05] hover:text-orange focus-visible:ring-2 focus-visible:ring-orange"
          >
            <span className="h-4 w-4">
              <SignOutIcon />
            </span>
            Sign out
          </button>
        </div>
      </aside>
      </div>

      {/* ---------- mobile top bar ---------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <Wordmark surface={surface} />
        <div className="flex items-center gap-1">
        <BackToWorkspace tone="ink" />
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-orange"
        >
          <span className="h-5 w-5">
            <SignOutIcon />
          </span>
        </button>
        </div>
      </header>

      <main className="min-w-0 flex-1">
        {children}
      </main>

      {/* ---------- mobile bottom tabs ---------- */}
      <nav aria-label={`${surface} sections`} className="fixed inset-x-0 bottom-0 z-30 flex border-t border-black/10 bg-white/95 backdrop-blur-md lg:hidden">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1">
            {({ isActive }) => (
              <>
                <span className={`h-5 w-5 ${isActive ? 'text-orange' : 'text-black/35'}`}>
                  <item.icon />
                </span>
                <span className={`text-[10px] font-semibold ${isActive ? 'text-ink' : 'text-black/45'}`}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
