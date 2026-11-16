// Static document catalog for the Documents page — id/name/required/conditional
// come from code; status/date are fetched from the Documents sheet tab (see
// api/documents.js) and merged in by DocumentsView. Two verticals:
//   INCUBATION_DOCUMENTS: mandatory admission requirements (+ 5 optional extras
//     in the same vertical, which don't count toward the progress bar)
//   FUNDING_DOCUMENTS: entirely optional, only relevant if applying for
//     pre-seed funding/grants — a separate purpose from incubation admission
//
// `conditional: true` (institutional-noc only) means "mandatory if applicable"
// rather than flatly mandatory — see conditionNote. Excluding it from the
// progress count for students it doesn't apply to is a backend decision for
// a later pass; for now it's just visually flagged as conditional.

export const INCUBATION_DOCUMENTS = [
  { id: 'bank-account-proof', name: 'Company Bank Account Proof', required: true },
  { id: 'incubation-mou', name: 'Signed Incubation MoU', required: true },
  { id: 'founders-kyc', name: 'Founders’ KYC', required: true },
  { id: 'ip-assignment', name: 'IP Assignment & Ownership Undertaking', required: true },
  {
    id: 'institutional-noc',
    name: 'Institutional NOC / Endorsement Letter',
    required: true,
    conditional: true,
    conditionNote: 'Only applies if a founder is a current student or faculty member.',
  },
  { id: 'coi', name: 'Certificate of Incorporation (CoI)', required: false },
  { id: 'constitutional-docs', name: 'Constitutional Documents (MoA & AoA or LLP Agreement)', required: false },
  { id: 'company-pan', name: 'Company PAN Card', required: false },
  { id: 'board-resolution', name: 'Board Resolution / Authority Letter', required: false },
  { id: 'cap-table', name: 'Cap Table (Shareholding Pattern)', required: false },
]

export const FUNDING_DOCUMENTS = [
  { id: 'dpiit', name: 'DPIIT Recognition Certificate' },
  { id: 'fund-utilization-plan', name: 'Fund Utilization Plan & Milestone Budget' },
  { id: 'inc-20a', name: 'Form INC-20A (Commencement of Business Proof)' },
  { id: 'gst-registration', name: 'GST Registration Certificate' },
  { id: 'udyam-registration', name: 'Udyam (MSME) Registration Certificate' },
  { id: 'prior-investment-docs', name: 'Prior Investment / Convertible Note Documents' },
  { id: 'patent-trademark-receipts', name: 'Patent / Trademark Filing Receipts' },
]
