// ChecklistStatus tab reader/writer. Columns (fixed order, matches
// scripts/setup-startup-junction-tabs.mjs): email | item_id | checked | checked_date
import { getCachedTab, cellToString, isChecked, todayISO, upsertRow } from './sheetsClient.js'
import { STAGES } from '../../src/data/journeyData.js'

const TAB = 'ChecklistStatus'
const EMAIL_COL = 0
const ITEM_ID_COL = 1
const CHECKED_COL = 2
const LAST_COL = 'D'

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
  const rows = (await getCachedTab(TAB)).slice(1)
  const checklist = {}
  for (const r of rows) {
    if (cellToString(r[EMAIL_COL]).trim() !== email) continue
    const itemId = cellToString(r[ITEM_ID_COL]).trim()
    if (VALID_ITEM_IDS.has(itemId)) checklist[itemId] = isChecked(r[CHECKED_COL])
  }
  return checklist
}

export async function setChecklistItem(email, itemId, checked) {
  await upsertRow(
    TAB,
    [EMAIL_COL, ITEM_ID_COL],
    [email, itemId],
    () => [email, itemId, checked ? 'TRUE' : 'FALSE', todayISO()],
    LAST_COL
  )
}
