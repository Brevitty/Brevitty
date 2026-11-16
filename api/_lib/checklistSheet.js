// ChecklistStatus tab reader/writer, by header name: email | item_id | checked | checked_date
import { todayISO, isChecked } from './sheetsClient.js'
import { rowsFor, upsert } from './pillarStore.js'
import { warmStartup } from './dashboardSheet.js'
import { STAGES } from '../../src/data/journeyData.js'

const TAB = 'ChecklistStatus'

// Only non-computed deliverables are sheet-backed — revenue-threshold and
// competition-entry are always derived (ledger total / verified competition),
// never stored, per the "stage progress is computed, not stored" rule.
export const VALID_ITEM_IDS = new Set(
  STAGES.flatMap((s) => s.deliverables).filter((d) => !d.computed).map((d) => d.id)
)

// { item_id: boolean } for every item the sheet has a row for; ids with no row
// are simply absent (the client treats a missing key as unchecked) — never throws
// for a student with no rows yet.
export async function getChecklist(email) {
  await warmStartup()
  return Object.fromEntries((await rowsFor(TAB, email)).filter((r) => VALID_ITEM_IDS.has(r.item_id)).map((r) => [r.item_id, isChecked(r.checked)]))
}

export async function setChecklistItem(email, itemId, checked) {
  await upsert(TAB, { email, item_id: itemId }, { checked: checked ? 'TRUE' : 'FALSE', checked_date: todayISO() })
}
