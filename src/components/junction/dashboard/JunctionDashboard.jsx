import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  STUDENT_PROFILE,
  MILESTONES,
  SESSIONS,
  RECENT_ACTIVITY,
} from '../../../data/mockJunctionDashboard.js'
import { useHideSiteChrome } from '../../../context/ChromeVisibilityContext.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import ChangePasswordModal from '../ChangePasswordModal.jsx'
import DashboardSidebar, { DashboardMobileNav } from './DashboardSidebar.jsx'
import OverviewView from './OverviewView.jsx'
import JourneyView from './journey/JourneyView.jsx'
import ToolkitView from './ToolkitView.jsx'
import MentorsView from './MentorsView.jsx'
import SessionsView from './SessionsView.jsx'
import AttendanceView from './AttendanceView.jsx'
import DocumentsView from './DocumentsView.jsx'
import {
  GridIcon,
  CompassIcon,
  UsersIcon,
  BookIcon,
  FileIcon,
  CalendarIcon,
  CalendarCheckIcon,
} from './icons.jsx'

const ease = [0.22, 1, 0.36, 1]
const THEME_STORAGE_KEY = 'sj-dashboard-theme'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: GridIcon },
  { id: 'journey', label: 'My Journey', icon: CompassIcon },
  { id: 'toolkit', label: 'Toolkit', icon: BookIcon },
  { id: 'mentors', label: 'Mentors', icon: UsersIcon },
  { id: 'sessions', label: 'Sessions', icon: CalendarIcon },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheckIcon },
  { id: 'documents', label: 'Documents', icon: FileIcon },
]
const NAV_IDS = new Set(NAV_ITEMS.map((n) => n.id))
const DEFAULT_VIEW = 'overview'

// The one real Startup Junction workspace UI. Both entry points — the
// standalone /startup-junction route (JunctionAuthGate) and /hub/startup
// (the site-wide Hub, once AuthContext/HubGate confirm the session) — render
// this same component so there is exactly one dashboard implementation.
export default function JunctionDashboard({ email, onSignOut, onUnauthorized }) {
  // Real signed-in name where the account has one (roster "name" column is
  // optional — empty string means unset, so we drop the name rather than
  // fall back to a placeholder); the rest of STUDENT_PROFILE (team) is still
  // mock data pending the real cohort data source.
  const { user } = useAuth()
  const student = { ...STUDENT_PROFILE, name: user?.name?.trim() || '' }
  const firstName = student.name ? student.name.split(/\s+/)[0] : ''

  const [changingPassword, setChangingPassword] = useState(false)
  // A deep link like #toolkit opens straight onto that section.
  const [activeView, setActiveView] = useState(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    return NAV_IDS.has(id) ? id : DEFAULT_VIEW
  })
  // Dashboard-local dark mode: a class on this component's own root, not
  // <html>, so it never touches the marketing site or the sign-in gate.
  const [isDark, setIsDark] = useState(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
    } catch {
      return false
    }
  })
  const toggleDark = () => {
    setIsDark((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light')
      } catch {
        /* private browsing / storage disabled — theme just won't persist */
      }
      return next
    })
  }

  // This is always a standalone app shell (own sidebar nav), in either entry point.
  useHideSiteChrome(true)

  return (
    <div className={`${isDark ? 'dark' : ''} bg-surface text-ink dark:bg-[#0c0a08] transition-colors duration-500`}>
      <div className="flex h-screen overflow-hidden">
        <DashboardSidebar
          navItems={NAV_ITEMS}
          activeView={activeView}
          onNavigate={setActiveView}
          student={student}
          milestones={MILESTONES}
          email={email}
          onChangePassword={() => setChangingPassword(true)}
          onSignOut={onSignOut}
          isDark={isDark}
          onToggleDark={toggleDark}
        />

        <main className="min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
          {/* Keyed remount (not AnimatePresence): with a single dynamically-keyed
              child, AnimatePresence's mode="wait" holds the outgoing element and
              never reliably swaps in the new one. A plain remount still gets the
              fade/slide-in via initial->animate; only the exit animation is lost. */}
          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease }}
          >
            {activeView === 'overview' && (
              <OverviewView
                firstName={firstName}
                sessions={SESSIONS}
                activity={RECENT_ACTIVITY}
                onNavigate={setActiveView}
                onUnauthorized={onUnauthorized}
              />
            )}
            {activeView === 'journey' && <JourneyView onUnauthorized={onUnauthorized} firstName={firstName} />}
            {activeView === 'toolkit' && <ToolkitView onUnauthorized={onUnauthorized} />}
            {activeView === 'mentors' && <MentorsView onUnauthorized={onUnauthorized} />}
            {activeView === 'sessions' && <SessionsView sessions={SESSIONS} onUnauthorized={onUnauthorized} />}
            {activeView === 'attendance' && <AttendanceView sessions={SESSIONS} onUnauthorized={onUnauthorized} />}
            {activeView === 'documents' && <DocumentsView onUnauthorized={onUnauthorized} />}
          </motion.div>
        </main>
      </div>

      <DashboardMobileNav
        navItems={NAV_ITEMS}
        activeView={activeView}
        onNavigate={setActiveView}
        student={student}
        email={email}
        onChangePassword={() => setChangingPassword(true)}
        onSignOut={onSignOut}
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      {changingPassword && (
        <ChangePasswordModal onClose={() => setChangingPassword(false)} onExpired={onUnauthorized} />
      )}
    </div>
  )
}
