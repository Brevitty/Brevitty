// Tab order and colour in the live Sheet, one group per area. setup-sheets.js applies it (organiseTabs).
// A tab missing from every group still works; it is just left after the grouped ones, uncoloured.
export const RENAMED_TABS = { MentorSessions: 'CohortSessions' } // old name -> new name, renamed in place so rows are kept

const hex = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 })

export const TAB_GROUPS = [
  { name: 'Hub / Admin', color: hex('#6b7280'), tabs: ['Students', 'Admins'] },
  { name: 'Startup Junction', color: hex('#f97316'), tabs: ['StartupProfiles', 'ChecklistStatus', 'Invoices', 'Documents', 'SessionProgress', 'CompetitionEntries', 'Attendance', 'MentorAssignments', 'Activity'] },
  { name: 'Consulting', color: hex('#2563eb'), tabs: ['Consultees', 'ConsultingSessions', 'Tasks', 'Deliverables'] },
  { name: 'Launchpad Abroad', color: hex('#7c3aed'), tabs: ['LP_Students', 'LP_Checklist', 'LP_Profile', 'LP_Documents', 'LP_Sessions', 'LP_Signoff', 'LP_Feedback', 'LP_Mentors'] },
  { name: 'Incubation', color: hex('#059669'), tabs: ['INC_Startups', 'INC_KPIs', 'INC_Funding', 'INC_Documents', 'INC_SchemeStatus'] },
  { name: 'VAC Learner', color: hex('#db2777'), tabs: ['VAC_Learners', 'VAC_Sessions', 'VAC_Attendance', 'VAC_Content', 'VAC_Assignments', 'VAC_Feedback'] },
  { name: 'Reference content', color: hex('#ca8a04'), tabs: ['CohortSessions', 'Mentors', 'Competitions', 'ItemResources', 'INC_SchemeList'] },
]
