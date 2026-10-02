import { useCallback } from 'react'
import { useJunctionFetch } from '../../lib/useJunctionFetch.js'
import { hubPost } from '../../lib/hubApi.js'
import { deriveLaunchpad } from '../../data/launchpadChecklist.js'
import PillarDashboard from '../hub/PillarDashboard.jsx'
import { LoadingView, ErrorView, NoRecordView } from '../hub/ui.jsx'
import { GridIcon, CompassIcon, IdCardIcon, CalendarIcon, FileIcon } from '../junction/dashboard/icons.jsx'
import OverviewView from './OverviewView.jsx'
import JourneyView from './JourneyView.jsx'
import ProfileView from './ProfileView.jsx'
import SessionsView from './SessionsView.jsx'
import DocumentsView from './DocumentsView.jsx'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: GridIcon },
  { id: 'journey', label: 'My Journey', icon: CompassIcon },
  { id: 'profile', label: 'Profile', icon: IdCardIcon },
  { id: 'sessions', label: 'Sessions', icon: CalendarIcon },
  { id: 'documents', label: 'Documents', icon: FileIcon },
]
const MILESTONE_STATUS = { done: 'complete', current: 'current', locked: 'upcoming' }

// Launchpad Abroad student workspace (/hub/launchpad). All data: GET /api/hub/launchpad.
export default function LaunchpadDashboard({ email, onSignOut, onUnauthorized }) {
  const load = useJunctionFetch('/api/hub/launchpad', onUnauthorized)
  const { data, setData } = load

  // POST, then fold the response into the loaded data (no refetch, no flash).
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

  const derived = data?.student ? deriveLaunchpad(data) : null
  const milestones = derived?.phases.map((p) => ({ id: p.id, n: p.n, label: p.label, status: MILESTONE_STATUS[p.status] })) ?? []

  const renderView = (view, navigate) => {
    if (load.loading && !data) return <LoadingView label="Loading your Launchpad…" />
    if (load.error && !data) return <ErrorView message={load.error} onRetry={load.refetch} />
    if (!data.student) return <NoRecordView workspace="Launchpad Abroad" />
    const saveField = (section, field, value) =>
      save('launchpad/profile', { section, field, value }, (d, r) => ({ ...d, profile: { ...d.profile, [`${r.section}.${r.field}`]: r.value } }))
    const lp = { data, ...derived, save, saveField, navigate }
    if (view === 'overview') return <OverviewView lp={lp} />
    if (view === 'journey') return <JourneyView lp={lp} />
    if (view === 'profile') return <ProfileView lp={lp} />
    if (view === 'sessions') return <SessionsView lp={lp} />
    return <DocumentsView lp={lp} />
  }

  return (
    <PillarDashboard
      workspaceLabel="Launchpad Abroad"
      navItems={NAV_ITEMS}
      teamName={data?.profile?.['startup.name'] || 'Your startup'}
      milestones={milestones}
      cardSubtitle={data?.student ? `Grade ${data.student.grade}` : ''}
      milestoneNoun="phases"
      email={email}
      onSignOut={onSignOut}
      onUnauthorized={onUnauthorized}
      renderView={renderView}
    />
  )
}
