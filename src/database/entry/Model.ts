import type {EntryStatus} from '#/core/Entry.js'
import type {DatabaseRecord} from '../Database.js'

export interface EntryCoreRecord extends DatabaseRecord {
  kind: 'entry'
  /** Stable logical id shared by locales and versions. */
  entryId: string
  /** Status encoded by the source file. */
  versionStatus: EntryStatus
  /** Status after inheritance from archived or draft parents. */
  status: EntryStatus
  active: boolean
  main: boolean
  type: string
  title: string
  seeded: string | null
  workspace: string
  root: string
  locale: string | null
  level: number
  index: string
  parentId: string | null
  parents: ReadonlyArray<string>
  path: string
  url: string
}

/** Source bookkeeping and payload links that require Role.read. */
export interface EntryReadRecord extends DatabaseRecord {
  kind: 'entryRead'
  entryVersionId: string
  filePath: string
  rowHash: string
  fileHash: string
  payloadId: string
  searchId?: string
}

export interface EntryPayloadRecord extends DatabaseRecord {
  kind: 'payload'
  data: Readonly<Record<string, unknown>>
}

export interface EntrySearchRecord extends DatabaseRecord {
  kind: 'search'
  entryVersionId: string
  /**
   * Explore search contains discovery-safe fields such as title and path.
   * Read search may additionally contain text derived from the payload.
   */
  audience: 'explore' | 'read'
  title: string
  searchableText: string
}

export type AlineaDatabaseRecord =
  | EntryCoreRecord
  | EntryReadRecord
  | EntryPayloadRecord
  | EntrySearchRecord

export function isEntryCoreRecord(
  record: AlineaDatabaseRecord | undefined
): record is EntryCoreRecord {
  return record?.kind === 'entry'
}
