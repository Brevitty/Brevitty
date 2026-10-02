import { useCallback } from 'react'
import { useJunctionFetch } from '../../lib/useJunctionFetch.js'
import { hubPost } from '../../lib/hubApi.js'
import PillarDashboard from '../hub/PillarDashboard.jsx'
import { LoadingView, ErrorView, NoRecordView } from '../hub/ui.jsx'
import { GridIcon, AwardIcon, CoinIcon, ClipboardIcon, CalendarIcon, UsersIcon, ClockIcon, ShieldIcon } from '../junction/dashboard/icons.jsx'
import {
  OverviewView, ProgramsView, DisbursementsView, ReportingView, EventsView, RelationshipView, RenewalsView, MouView,
} from './PartnerViews.jsx'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: GridIcon, View: OverviewView },
  { id: 'programs', label: 'Programs', icon: AwardIcon, View: ProgramsView },
  { id: 'disbursements', label: 'Disbursements', icon: CoinIcon, View: DisbursementsView },
  { id: 'reporting', label: 'Reporting', icon: ClipboardIcon, View: ReportingView },
  { id: 'events', label: 'Events', icon: CalendarIcon, View: EventsView },
  { id: 'relationship', label: 'Relationship', icon: UsersIcon, View: RelationshipView },
  { id: 'renewals', label: 'Renewals', icon: ClockIcon, View: RenewalsView },
  { id: 'mou', label: 'MoU', icon: ShieldIcon, View: MouView },
]

// Partner Services workspace (/hub/partner). All data: GET /api/hub/partner.
export default function PartnerDashboard({ email, onSignOut, onUnauthorized }) {
  const load = useJunctionFetch('/api/hub/partner', onUnauthorized)
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
    if (load.loading && !data) return <LoadingView label="Loading your partner workspace…" />
    if (load.error && !data) return <ErrorView message={load.error} onRetry={load.refetch} />
    if (!data.partner) return <NoRecordView workspace="Partner Services" />
    const { View } = NAV_ITEMS.find((n) => n.id === view)
    // Report submissions change the "reports due" summary, which the server computes: refetch after.
    return <View data={data} save={save} navigate={navigate} refetch={load.refetch} />
  }

  return (
    <PillarDashboard
      workspaceLabel="Partner Services"
      navItems={NAV_ITEMS}
      teamName={data?.partner?.org_name || 'Your organisation'}
      email={email}
      onSignOut={onSignOut}
      onUnauthorized={onUnauthorized}
      renderView={renderView}
    />
  )
}
