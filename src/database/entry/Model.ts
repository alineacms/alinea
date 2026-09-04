import type {EntryStatus} from '#/core/Entry.js'

export interface EntryCoreRecord {
  id: string
  kind: 'entry'
  /** Hidden physical versions are retained server-side but excluded from scans. */
  queryable: boolean
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
  /** Read-protected URL claims available to core-only server queries. */
  urlAliases?: ReadonlyArray<string>
}

export interface EntryPayloadRecord {
  id: string
  kind: 'payload'
  entryVersionId: string
  data: Readonly<Record<string, unknown>>
}

export interface EntrySearchRecord {
  id: string
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
