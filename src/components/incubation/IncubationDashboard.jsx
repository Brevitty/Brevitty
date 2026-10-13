import { Component, useCallback, useEffect, useState } from 'react'
import { useJunctionFetch } from '../../lib/useJunctionFetch.js'
import PillarDashboard from '../hub/PillarDashboard.jsx'
import { LoadingView, ErrorView } from '../hub/ui.jsx'
import { GridIcon, FileIcon, ChartIcon, CoinIcon, AwardIcon, IdCardIcon } from '../junction/dashboard/icons.jsx'
import { OverviewView, ProfileView, KpisView, SchemesView } from './IncubationViews.jsx'
import MouDocumentsView from './MouDocumentsView.jsx'
import FundingView from './FundingView.jsx'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: GridIcon, View: OverviewView },
  { id: 'profile', label: 'Profile', icon: IdCardIcon, View: ProfileView },
  { id: 'mou', label: 'MoU & Documents', icon: FileIcon, View: MouDocumentsView },
  { id: 'kpis', label: 'KPIs', icon: ChartIcon, View: KpisView },
  { id: 'funding', label: 'Funding', icon: CoinIcon, View: FundingView },
  { id: 'schemes', label: 'Schemes', icon: AwardIcon, View: SchemesView },
]

// Sections that were removed or merged into MoU & Documents; old bookmarks land there.
const LEGACY_HASHES = new Set(['compliance', 'documents', 'media', 'resources', 'exit'])
const MERGED_HASH = 'mou'
const TOAST_MS = 4500

function redirectLegacyHash() {
  if (LEGACY_HASHES.has(decodeURIComponent(window.location.hash.slice(1)))) window.history.replaceState(null, '', `#${MERGED_HASH}`)
}

// A view that throws (bad sheet data) must not blank the whole workspace.
class ViewBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    console.error('[incubation] view crashed', err)
  }
  render() {
    return this.state.failed ? <ErrorView message="This section could not be displayed. Reload the page; if it persists, contact the Hub team." /> : this.props.children
  }
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-24 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg lg:bottom-8 ${
        toast.error ? 'bg-red-600' : 'bg-[#0a0a0a]'
      }`}
    >
      {toast.message}
    </div>
  )
}

// Incubation workspace (/hub/incubation). All data: GET /api/hub/incubation (Sheets); files: Supabase Storage.
export default function IncubationDashboard({ email, onSignOut, onUnauthorized }) {
  useState(redirectLegacyHash) // before PillarDashboard reads the hash
  const load = useJunctionFetch('/api/hub/incubation', onUnauthorized)
  const { data, setData } = load
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  const notify = useCallback((message, error = false) => setToast({ message, error }), [])

  // Runs a write that resolves to the refreshed workspace. Never throws: resolves null after
  // toasting the error, so a view only resets its form when the save really happened.
  const run = useCallback(
    async (action, success) => {
      try {
        const res = await action()
        setData(res)
        if (success) notify(success)
        return res
      } catch (err) {
        if (err.status === 401) onUnauthorized()
        notify(err.message || 'Something went wrong.', true)
        return null
      }
    },
    [setData, notify, onUnauthorized]
  )

  const renderView = (view, navigate) => {
    if (load.loading && !data) return <LoadingView label="Loading your incubation workspace…" />
    if (load.error && !data) return <ErrorView message={load.error} onRetry={load.refetch} />
    if (!data.startup) return <ProfileView data={data} run={run} /> // first visit: create the record
    const { View } = NAV_ITEMS.find((n) => n.id === view)
    return (
      <ViewBoundary key={view}>
        <View data={data} run={run} notify={notify} navigate={navigate} />
      </ViewBoundary>
    )
  }

  return (
    <>
      <PillarDashboard
        workspaceLabel="Incubation"
        navItems={NAV_ITEMS}
        teamName={data?.startup?.startup || 'Your startup'}
        email={email}
        onSignOut={onSignOut}
        onUnauthorized={onUnauthorized}
        renderView={renderView}
      />
      <Toast toast={toast} />
    </>
  )
}
