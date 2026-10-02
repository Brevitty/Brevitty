import { useCallback } from 'react'
import { useJunctionFetch } from '../../lib/useJunctionFetch.js'
import { hubPost } from '../../lib/hubApi.js'
import PillarDashboard from '../hub/PillarDashboard.jsx'
import { LoadingView, ErrorView, NoRecordView } from '../hub/ui.jsx'
import { GridIcon, ShieldIcon, ChartIcon, CoinIcon, FileIcon, AwardIcon, MegaphoneIcon, BookIcon, FlagIcon } from '../junction/dashboard/icons.jsx'
import {
  OverviewView, ComplianceView, KpisView, FundingView, DocumentsView, SchemesView, MediaView, ResourcesView, ExitView,
} from './IncubationViews.jsx'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: GridIcon, View: OverviewView },
  { id: 'compliance', label: 'MoU & Compliance', icon: ShieldIcon, View: ComplianceView },
  { id: 'kpis', label: 'KPIs', icon: ChartIcon, View: KpisView },
  { id: 'funding', label: 'Funding', icon: CoinIcon, View: FundingView },
  { id: 'documents', label: 'Documents', icon: FileIcon, View: DocumentsView },
  { id: 'schemes', label: 'Schemes', icon: AwardIcon, View: SchemesView },
  { id: 'media', label: 'Media & PR', icon: MegaphoneIcon, View: MediaView },
  { id: 'resources', label: 'Resources', icon: BookIcon, View: ResourcesView },
  { id: 'exit', label: 'Exit Status', icon: FlagIcon, View: ExitView },
]

// Incubation workspace (/hub/incubation). All data: GET /api/hub/incubation.
export default function IncubationDashboard({ email, onSignOut, onUnauthorized }) {
  const load = useJunctionFetch('/api/hub/incubation', onUnauthorized)
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
    if (load.loading && !data) return <LoadingView label="Loading your incubation workspace…" />
    if (load.error && !data) return <ErrorView message={load.error} onRetry={load.refetch} />
    if (!data.startup) return <NoRecordView workspace="Incubation" />
    const { View } = NAV_ITEMS.find((n) => n.id === view)
    return <View data={data} save={save} navigate={navigate} />
  }

  return (
    <PillarDashboard
      workspaceLabel="Incubation"
      navItems={NAV_ITEMS}
      teamName={data?.startup?.startup || 'Your startup'}
      email={email}
      onSignOut={onSignOut}
      onUnauthorized={onUnauthorized}
      renderView={renderView}
    />
  )
}
