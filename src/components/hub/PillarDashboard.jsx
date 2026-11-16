import { useState } from 'react'
import { motion } from 'framer-motion'
import { useHideSiteChrome } from '../../context/ChromeVisibilityContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import ChangePasswordModal from '../junction/ChangePasswordModal.jsx'
import DashboardSidebar, { DashboardMobileNav } from '../junction/dashboard/DashboardSidebar.jsx'
import { ease } from '../junction/dashboard/motionVariants.js'
import { MY_WORKSPACE_PATH } from './BackToWorkspace.jsx'

// Same key as JunctionDashboard, so a student's light/dark choice follows them across workspaces.
const THEME_STORAGE_KEY = 'sj-dashboard-theme'

// The Startup Junction dashboard shell (persistent sidebar, mobile tab bar, dashboard-local dark
// mode, keyed view swap, Settings -> ChangePasswordModal) for the other Hub workspaces.
// `renderView(activeView, navigate)` returns the active section's view.
export default function PillarDashboard({
  workspaceLabel,
  navItems,
  teamName,
  milestones,
  cardSubtitle,
  milestoneNoun,
  email,
  onSignOut,
  onUnauthorized,
  renderView,
}) {
  const { user } = useAuth()
  const navIds = new Set(navItems.map((n) => n.id))
  const [activeView, setActiveView] = useState(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    return navIds.has(id) ? id : navItems[0].id
  })
  const [changingPassword, setChangingPassword] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
    } catch {
      return false
    }
  })
  const toggleDark = () =>
    setIsDark((prev) => {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, prev ? 'light' : 'dark')
      } catch {
        /* storage disabled: the theme just won't persist */
      }
      return !prev
    })
  const navigate = (id) => {
    setActiveView(id)
    window.history.replaceState(null, '', `#${id}`)
  }

  useHideSiteChrome(true)
  const student = { teamName, name: user?.name?.trim() || '' }
  const shared = {
    navItems,
    activeView,
    onNavigate: navigate,
    student,
    email,
    onChangePassword: () => setChangingPassword(true),
    onSignOut,
    isDark,
    onToggleDark: toggleDark,
    backTo: MY_WORKSPACE_PATH,
  }

  return (
    <div className={`${isDark ? 'dark' : ''} bg-surface text-ink transition-colors duration-500 dark:bg-[#0c0a08]`}>
      <div className="flex h-screen overflow-hidden">
        <DashboardSidebar
          {...shared}
          milestones={milestones}
          workspaceLabel={workspaceLabel}
          cardSubtitle={cardSubtitle}
          milestoneNoun={milestoneNoun}
        />
        <main className="min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
          <motion.div key={activeView} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease }}>
            {renderView(activeView, navigate)}
          </motion.div>
        </main>
      </div>
      <DashboardMobileNav {...shared} />
      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} onExpired={onUnauthorized} />}
    </div>
  )
}
