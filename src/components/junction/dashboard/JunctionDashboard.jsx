import { useState } from 'react'
import { motion } from 'framer-motion'
import { getInvoiceTotal, getStagesWithStatus, hasVerifiedCompetitionEntry } from '../../../data/journeyData.js'
import { useJunctionFetch } from '../../../lib/useJunctionFetch.js'
import { hubPost } from '../../../lib/hubApi.js'
import { LoadingView } from '../../hub/ui.jsx'
import { useChecklist } from '../../../lib/useChecklist.js'
import { JunctionDataContext } from '../../../lib/junctionData.js'
import { useHideSiteChrome } from '../../../context/ChromeVisibilityContext.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import ChangePasswordModal from '../ChangePasswordModal.jsx'
import { MY_WORKSPACE_PATH } from '../../hub/BackToWorkspace.jsx'
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
const EMPTY_DASHBOARD = { profile: null, invoices: [], sessions: [], activity: [], competitions: [], resources: {} }
const MILESTONE_STATUS = { done: 'complete', current: 'current', locked: 'upcoming' }

// The one real Startup Junction workspace UI. Both entry points — the
// standalone /startup-junction route (JunctionAuthGate) and /hub/startup
// (the site-wide Hub, once AuthContext/HubGate confirm the session) — render
// this same component so there is exactly one dashboard implementation.
export default function JunctionDashboard({ email, onSignOut, onUnauthorized }) {
  // Real signed-in name where the account has one (roster "name" column is
  // optional — empty string means unset, so we drop the name rather than
  // fall back to a placeholder). Team, invoices, sessions and activity come from
  // the sheet via /api/hub/dashboard; the checklist is loaded once here and shared.
  const { user } = useAuth()
  const dashboard = useJunctionFetch('/api/hub/dashboard', onUnauthorized)
  const checklist = useChecklist(onUnauthorized)
  const data = dashboard.data || EMPTY_DASHBOARD
  const student = { teamName: data.profile?.teamName || 'Your startup', name: user?.name?.trim() || '' }
  const firstName = student.name ? student.name.split(/\s+/)[0] : ''

  // Sidebar progress uses the same checklist-derived stages as Overview and My Journey.
  const milestones = getStagesWithStatus(
    checklist.checklistState,
    getInvoiceTotal(data.invoices),
    hasVerifiedCompetitionEntry(data.competitions)
  ).map((st) => ({ id: st.id, n: st.n, label: st.label, status: MILESTONE_STATUS[st.status] }))
  // Optimistic: the card updates at once, the server's list replaces it, a failed save restores the old list and rethrows.
  const saveCompetition = async (compId, changes) => {
    const before = data.competitions
    const apply = (c) => ({
      ...c,
      ...(changes.status !== undefined && { status: changes.status }),
      ...(changes.saved !== undefined && { saved: changes.saved }),
      ...(changes.add_proof && { proof: [...c.proof.filter((p) => p !== changes.add_proof), changes.add_proof] }),
      ...(changes.remove_proof && { proof: c.proof.filter((p) => p !== changes.remove_proof) }),
    })
    dashboard.setData((d) => ({ ...d, competitions: d.competitions.map((c) => (c.id === compId ? apply(c) : c)) }))
    try {
      const res = await hubPost('competitions', { comp_id: compId, ...changes })
      dashboard.setData((d) => ({ ...d, competitions: res.competitions }))
    } catch (err) {
      dashboard.setData((d) => ({ ...d, competitions: before }))
      if (err.status === 401) onUnauthorized()
      throw err
    }
  }
  const shared = { ...data, checklist, saveCompetition }

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
          milestones={milestones}
          email={email}
          onChangePassword={() => setChangingPassword(true)}
          onSignOut={onSignOut}
          isDark={isDark}
          onToggleDark={toggleDark}
          backTo={MY_WORKSPACE_PATH}
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
            {dashboard.loading ? (
              <LoadingView label="Loading your dashboard…" />
            ) : dashboard.error ? (
              <div className="p-6 lg:p-10">
                <p className="text-sm font-medium text-red-500">{dashboard.error}</p>
                <button type="button" onClick={dashboard.refetch} className="mt-4 rounded-full bg-orange px-5 py-2 text-sm font-semibold text-ink">
                  Try again
                </button>
              </div>
            ) : (
              <JunctionDataContext.Provider value={shared}>
                {activeView === 'overview' && (
                  <OverviewView
                    firstName={firstName}
                    sessions={data.sessions}
                    activity={data.activity}
                    onNavigate={setActiveView}
                    onUnauthorized={onUnauthorized}
                  />
                )}
                {activeView === 'journey' && <JourneyView onUnauthorized={onUnauthorized} firstName={firstName} />}
                {activeView === 'toolkit' && <ToolkitView onUnauthorized={onUnauthorized} />}
                {activeView === 'mentors' && <MentorsView onUnauthorized={onUnauthorized} />}
                {activeView === 'sessions' && <SessionsView sessions={data.sessions} onUnauthorized={onUnauthorized} />}
                {activeView === 'attendance' && <AttendanceView sessions={data.sessions} onUnauthorized={onUnauthorized} />}
                {activeView === 'documents' && <DocumentsView onUnauthorized={onUnauthorized} />}
              </JunctionDataContext.Provider>
            )}
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
        backTo={MY_WORKSPACE_PATH}
      />

      {changingPassword && (
        <ChangePasswordModal onClose={() => setChangingPassword(false)} onExpired={onUnauthorized} />
      )}
    </div>
  )
}
