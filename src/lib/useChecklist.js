import { useEffect, useState } from 'react'
import { getDefaultChecklistState } from '../data/journeyData.js'
import { useJunctionFetch } from './useJunctionFetch.js'

// The one place that fetches ChecklistStatus and applies optimistic writes.
// Shared by JourneyView and OverviewView so both call getStagesWithStatus on
// the exact same checklistState — their stage/percentage can never disagree.
export function useChecklist(onUnauthorized) {
  const [checklistState, setChecklistState] = useState(getDefaultChecklistState)
  const { loading, error, data } = useJunctionFetch('/api/checklist', onUnauthorized)

  useEffect(() => {
    if (data?.checklist) setChecklistState({ ...getDefaultChecklistState(), ...data.checklist })
  }, [data])

  // Optimistic toggle, persisted server-side; reverted if the save fails.
  const toggleItem = async (itemId) => {
    const next = !checklistState[itemId]
    setChecklistState((prev) => ({ ...prev, [itemId]: next }))
    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, checked: next }),
      })
      if (res.status === 401) return onUnauthorized()
      if (!res.ok) throw new Error()
    } catch {
      setChecklistState((prev) => ({ ...prev, [itemId]: !next }))
    }
  }

  return { loading, error, checklistState, toggleItem }
}
