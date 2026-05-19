import type {FlatTree} from '../source/Tree.js'
import type {EntryManifest} from './EntryManifest.js'
import type {EntryNodeId, EntryRowId, EntryRowStore} from './EntryRows.js'

export const ENTRY_SNAPSHOT_VERSION = 1

export interface EntrySnapshot {
  version: typeof ENTRY_SNAPSHOT_VERSION
  manifest: EntryManifest
  graphSha: string
  tree: FlatTree
  rows: EntryRowStore
  indexes: EntrySnapshotIndexes
  search?: EntrySearchSnapshot
}

export interface EntrySnapshotIndexes {
  byId: Record<string, Array<EntryRowId>>
  byFilePath: Record<string, EntryRowId>
  byDir: Record<string, EntryNodeId>
  byParent: Record<string, Array<EntryRowId>>
  byType: Record<string, Array<EntryRowId>>
  byWorkspace: Record<string, Array<EntryRowId>>
  byRoot: Record<string, Array<EntryRowId>>
  byLocale: Record<string, Array<EntryRowId>>
  byStatus: Record<string, Array<EntryRowId>>
}

export interface EntrySearchSnapshot {
  kind: 'minisearch-json' | 'tokens'
  data: unknown
}
