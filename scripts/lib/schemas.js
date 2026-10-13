// Every tab the Hub reads or writes, with its row-1 headers. One list shared by setup-sheets.js
// (creates what is missing) and seed-demo.js (fills it), so the two can never disagree.
// Keep each tab's headers next to the code that owns it; this file only collects them.
import './sheetSetup.mjs' // loads .env.local before the STUDENTS_TAB lookup below
import { DASHBOARD_TABS, COMPETITION_TABS } from '../../api/_lib/dashboardSheet.js'
import { LP_TABS } from '../../api/_lib/launchpadSheet.js'
import { INC_TABS } from '../../api/_lib/incubationSheet.js'
import { VAC_TABS } from '../../api/_lib/vacSheet.js'
import { TABS as CONSULTING_TABS } from '../../src/data/consultingConstants.js'

export const STUDENTS_TAB = process.env.GOOGLE_SHEET_TAB?.trim() || 'Students'

// Startup Junction tabs whose readers are header-name based but whose headers were defined by the setup scripts.
const STARTUP_TABS = {
  [STUDENTS_TAB]: ['email', 'password', 'name', 'memberships'],
  ChecklistStatus: ['email', 'item_id', 'checked', 'checked_date'],
  Documents: ['email', 'doc_id', 'status', 'submitted_date', 'file_url'],
  SessionProgress: ['email', 'session_id', 'completed', 'quiz_score', 'completed_date'],
}

export const ALL_SCHEMAS = {
  ...STARTUP_TABS,
  ...DASHBOARD_TABS,
  ...COMPETITION_TABS,
  ...CONSULTING_TABS,
  ...LP_TABS,
  ...INC_TABS,
  ...VAC_TABS,
}
