import type {
  EntryReference,
  EntryReferenceScan
} from '#/core/db/EntryReference.js'
import type {EntryStatus} from '#/core/Entry.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import type {Infer} from '#/types.js'

export interface DashboardEntryTreeStatus {
  status: EntryStatus | 'unpublished' | 'untranslated'
}

export interface DashboardFileInfoState {
  pending: boolean
  data: Infer<typeof MediaFile> | null | undefined
}

export interface DashboardEntryReferences {
  references: Array<DashboardEntryReference>
  total: number
  scan: EntryReferenceScan
}

export interface DashboardEntryReference {
  reference: EntryReference
  source: DashboardEntryReferenceSource
}

export interface DashboardEntryReferenceSource {
  id: string
  title: string
  type: string
  workspace: string
  root: string
  locale: string | null
  status: EntryStatus
  path: string
  url: string
}

export interface EntryRouteBlock {
  confirm(): void
  cancel(): void
}
