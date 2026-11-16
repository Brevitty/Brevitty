import { useCallback } from 'react'
import { useJunctionFetch } from '../../lib/useJunctionFetch.js'
import { hubPost } from '../../lib/hubApi.js'
import PillarDashboard from '../hub/PillarDashboard.jsx'
import { LoadingView, ErrorView } from '../hub/ui.jsx'
import EnrollView from './EnrollView.jsx'
import { GridIcon, BookIcon, ClockIcon, CalendarCheckIcon, FileIcon, ClipboardIcon, AwardIcon, ChatIcon } from '../junction/dashboard/icons.jsx'
import {
  OverviewView, CourseView, ScheduleView, AttendanceView, ContentView, AssignmentsView, CertificateView, FeedbackView,
} from './VacViews.jsx'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: GridIcon, View: OverviewView },
  { id: 'course', label: 'Course', icon: BookIcon, View: CourseView },
  { id: 'schedule', label: 'Schedule', icon: ClockIcon, View: ScheduleView },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheckIcon, View: AttendanceView },
  { id: 'content', label: 'Content', icon: FileIcon, View: ContentView },
  { id: 'assignments', label: 'Assignments', icon: ClipboardIcon, View: AssignmentsView },
  { id: 'certificate', label: 'Certificate', icon: AwardIcon, View: CertificateView },
  { id: 'feedback', label: 'Feedback', icon: ChatIcon, View: FeedbackView },
]

// VAC Learner workspace (/hub/vac). All data: GET /api/hub/vac.
export default function VacDashboard({ email, onSignOut, onUnauthorized }) {
  const load = useJunctionFetch('/api/hub/vac', onUnauthorized)
  const { data, setData } = load

  const save = useCallback(
    async (path, body, apply) => {
      try {
        const res = await hubPost(path, body)
        setData((d) => apply(d, res))
        return res
      } catch (err) {
        if (err.status === 401) onUnauthorized()
        throw err
      }
    },
    [setData, onUnauthorized]
  )

  const renderView = (view, navigate) => {
    if (load.loading && !data) return <LoadingView label="Loading your course…" />
    if (load.error && !data) return <ErrorView message={load.error} onRetry={load.refetch} />
    if (!data.learner) return <EnrollView courses={data.courses} save={save} />
    const { View } = NAV_ITEMS.find((n) => n.id === view)
    // Assignment saves change certificate eligibility, which the server computes: refetch after.
    return <View data={data} save={save} navigate={navigate} refetch={load.refetch} />
  }

  return (
    <PillarDashboard
      workspaceLabel="VAC Learner"
      navItems={NAV_ITEMS}
      teamName={data?.learner?.course || 'Your course'}
      email={email}
      onSignOut={onSignOut}
      onUnauthorized={onUnauthorized}
      renderView={renderView}
    />
  )
}
