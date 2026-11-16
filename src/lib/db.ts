// Data layer for the Incubation workspace: every read/write the components make goes through here.
// Reads: GET /api/hub/incubation. Writes return the refreshed workspace so views just replace state.
// (Backed by Google Sheets via api/_lib/incubationSheet.js; files are uploaded via storage.ts.)
import { hubPost } from './hubApi.js'

export type IncubationData = any // shape: see getIncubation() in api/_lib/incubationSheet.js

export type KpiInput = { period: string; values: { revenue?: string; runway?: string; jobs?: string } }
export type FundingInput = {
  id?: string
  funder: string
  type: string
  amount: string
  date: string
  status: string
  notes: string
  file_path?: string
  file_name?: string
}

export type ProfileInput = { startup: string; founder_name: string; sector: string; stage: string; website: string }

export const saveProfile = (input: ProfileInput): Promise<IncubationData> => hubPost('incubation/profile', input)

export const saveKpis = (input: KpiInput): Promise<IncubationData> => hubPost('incubation/kpis', input)

// kind: mou | dpiit | ip | other. For 'other', pass a title (new) or the doc id (replace).
// The file is uploaded first (storage.ts); this saves its path. A replaced file is deleted server-side.
export const saveDocument = (input: { kind: string; title?: string; id?: string; file_path: string; file_name: string }): Promise<IncubationData> =>
  hubPost('incubation/documents', input)

// file_path/file_name only when a new proof was uploaded (it replaces the old one).
export const saveFunding = (input: FundingInput): Promise<IncubationData> => hubPost('incubation/funding', input)

export const deleteFunding = (id: string): Promise<IncubationData> => hubPost('incubation/funding/delete', { id })

export const setSchemeStatus = (schemeId: string, status: string): Promise<IncubationData> =>
  hubPost('incubation/schemes/status', { scheme_id: schemeId, status })
