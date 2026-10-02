// Admin panel for the consultant. Each view loads its own data through consultingApi.admin.
import { Route, Routes, Navigate } from 'react-router-dom'
import ConsultingShell from '../ConsultingShell.jsx'
import { GridIcon, UsersIcon, CalendarIcon, CalendarCheckIcon } from '../../junction/dashboard/icons.jsx'
import TodayView from './TodayView.jsx'
import ConsulteesView from './ConsulteesView.jsx'
import ConsulteeDetailView from './ConsulteeDetailView.jsx'
import ScheduleView from './ScheduleView.jsx'
import SessionsListView from './SessionsListView.jsx'
import SessionDetailView from './SessionDetailView.jsx'

import { ADMIN_BASE } from './paths.js'

const NAV = [
  { to: ADMIN_BASE, end: true, label: 'Today', icon: GridIcon },
  { to: `${ADMIN_BASE}/consultees`, label: 'Consultees', icon: UsersIcon },
  { to: `${ADMIN_BASE}/schedule`, label: 'Schedule', icon: CalendarIcon },
  { to: `${ADMIN_BASE}/sessions`, label: 'Sessions', icon: CalendarCheckIcon },
]

export default function AdminApp({ account, onSignOut }) {
  return (
    <ConsultingShell surface="Admin" nav={NAV} account={account} onSignOut={onSignOut}>
      <Routes>
        <Route index element={<TodayView />} />
        <Route path="consultees" element={<ConsulteesView />} />
        <Route path="consultees/:email" element={<ConsulteeDetailView />} />
        <Route path="schedule" element={<ScheduleView />} />
        <Route path="sessions" element={<SessionsListView />} />
        <Route path="sessions/:id" element={<SessionDetailView />} />
        <Route path="*" element={<Navigate to={ADMIN_BASE} replace />} />
      </Routes>
    </ConsultingShell>
  )
}
