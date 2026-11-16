import PillarDashboard from '../hub/PillarDashboard.jsx'
import { GridIcon, FlagIcon, ClockIcon, ChartIcon, UsersIcon, BookIcon, AwardIcon, CalendarCheckIcon } from '../junction/dashboard/icons.jsx'
import { MasterView, AtRiskView, WorkloadView, ReportsView, UsersView } from './HubAdminViews.jsx'
import { ContentView } from './ContentView.jsx'
import { LaunchpadStudentsView } from './LaunchpadStudentsView.jsx'
import { AttendanceAdminView } from './AttendanceAdminView.jsx'

// ids match the Hub Admin nav in hubPillars.js
const NAV_ITEMS = [
  { id: 'master', label: 'Master Dashboard', icon: GridIcon, View: MasterView },
  { id: 'at-risk', label: 'At-Risk Flags', icon: FlagIcon, View: AtRiskView },
  { id: 'workload', label: 'Workload', icon: ClockIcon, View: WorkloadView },
  { id: 'reports', label: 'Reports', icon: ChartIcon, View: ReportsView },
  { id: 'users', label: 'User Management', icon: UsersIcon, View: UsersView },
  { id: 'launchpad', label: 'Launchpad students', icon: AwardIcon, View: LaunchpadStudentsView },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheckIcon, View: AttendanceAdminView },
  { id: 'content', label: 'Content', icon: BookIcon, View: ContentView },
]

// Hub Admin workspace (/hub/admin). Every view fetches /api/hub/admin/*, which the server only answers
// for an account in the Admins tab (403 otherwise); hiding the card for others is UX, not security.
export default function HubAdminDashboard({ email, onSignOut, onUnauthorized }) {
  const renderView = (view, navigate) => {
    const { View } = NAV_ITEMS.find((n) => n.id === view)
    return <View key={view} onUnauthorized={onUnauthorized} onNavigate={navigate} />
  }
  return (
    <PillarDashboard
      workspaceLabel="Hub Admin"
      navItems={NAV_ITEMS}
      teamName="Hub Admin"
      email={email}
      onSignOut={onSignOut}
      onUnauthorized={onUnauthorized}
      renderView={renderView}
    />
  )
}
