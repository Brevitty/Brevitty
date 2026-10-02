import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  COMPETITIONS,
  getInvoiceTotal,
  getStagesWithStatus,
  hasVerifiedCompetitionEntry,
} from '../../../../data/journeyData.js'
import { useJunctionData } from '../../../../lib/junctionData.js'
import { ease } from '../motionVariants.js'
import { TabBar } from '../shared.jsx'
import JourneyHome from './JourneyHome.jsx'
import MyStartupView from './MyStartupView.jsx'
import CompetitionsView from './CompetitionsView.jsx'

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'startup', label: 'My Startup' },
  { id: 'competitions', label: 'Competitions' },
]

// Owns the state shared across My Journey's sub-views: checklist toggles and
// competitions both feed the stage rail's "current"/"locked" computation
// (getStagesWithStatus), so they're lifted here rather than duplicated in
// MyStartupView and JourneyHome.
export default function JourneyView({ onUnauthorized, firstName }) {
  const [activeTab, setActiveTab] = useState('home')
  const [competitions, setCompetitions] = useState(COMPETITIONS)
  const [jumpTarget, setJumpTarget] = useState(null)

  const { invoices, checklist } = useJunctionData()
  const { loading, error, checklistState, toggleItem } = checklist

  const ledgerTotal = getInvoiceTotal(invoices)
  const verifiedCompetition = hasVerifiedCompetitionEntry(competitions)
  const stages = getStagesWithStatus(checklistState, ledgerTotal, verifiedCompetition)

  const goToItem = (stageId, itemId) => {
    setJumpTarget({ stageId, itemId, token: Date.now() })
    setActiveTab('startup')
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-black/40">Loading your journey…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-sm font-medium text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-orange">My journey</p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Your startup journey, mapped.
          </h2>
        </div>

        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease }}
          className="mt-10"
        >
          {activeTab === 'home' && (
            <JourneyHome
              stages={stages}
              checklistState={checklistState}
              ledgerTotal={ledgerTotal}
              hasVerifiedCompetition={verifiedCompetition}
              onGoToItem={goToItem}
              onNavigateTab={setActiveTab}
              firstName={firstName}
            />
          )}
          {activeTab === 'startup' && (
            <MyStartupView
              stages={stages}
              checklistState={checklistState}
              onToggleItem={toggleItem}
              ledgerTotal={ledgerTotal}
              hasVerifiedCompetition={verifiedCompetition}
              jumpTarget={jumpTarget}
            />
          )}
          {activeTab === 'competitions' && (
            <CompetitionsView competitions={competitions} onChange={setCompetitions} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
