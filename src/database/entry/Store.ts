import type {Entry} from '#/core/Entry.js'
import type {EntryStatus} from '#/core/Entry.js'
import type {EntryCoreRecord, EntrySearchRecord} from './Model.js'

export interface EntryLinkReference {
  targetId: string
  sourceEntryId: string
  sourceVersionId: string
  sourceFilePath: string
  sourceType: string
  sourceLocale: string | null
  sourceStatus: EntryStatus
  sourceActive: boolean
  sourceMain: boolean
  fieldPath: string
  fieldLabel?: string
  linkId?: string
  linkType?: 'entry' | 'image' | 'file'
}

export interface EntryStore {
  readonly revision: string

  cores(signal?: AbortSignal): Promise<ReadonlyArray<EntryCoreRecord>>

  load(core: EntryCoreRecord, signal?: AbortSignal): Promise<Entry | undefined>

  loadMany(
    cores: ReadonlyArray<EntryCoreRecord>,
    signal?: AbortSignal
  ): Promise<Array<Entry | undefined>>

  search(
    core: EntryCoreRecord,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ): Promise<EntrySearchRecord | undefined>

  searchMany(
    cores: ReadonlyArray<EntryCoreRecord>,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ): Promise<Array<EntrySearchRecord | undefined>>

  referencesTo(
    targetId: string,
    signal?: AbortSignal
  ): AsyncIterable<EntryLinkReference>

  referencesFrom(
    sourceId: string,
    signal?: AbortSignal
  ): AsyncIterable<EntryLinkReference>
}
