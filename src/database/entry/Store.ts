import type {Entry} from '#/core/Entry.js'
import type {DatabaseSnapshot} from '../Database.js'
import type {DatabaseReader} from '../Reader.js'
import {SnapshotDatabaseReader} from '../Reader.js'
import {
  referencesBySource,
  referencesByTarget,
  type EntryLinkReference
} from './Indexes.js'
import {EntryLoader} from './Loader.js'
import type {
  AlineaDatabaseRecord,
  EntryCoreRecord,
  EntrySearchRecord
} from './Model.js'
import {EntryQueryEngine} from './Query.js'

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

export class ReaderEntryStore implements EntryStore {
  #reader: DatabaseReader<AlineaDatabaseRecord>
  #loader: EntryLoader
  #cores: Promise<ReadonlyArray<EntryCoreRecord>>

  constructor(
    source:
      | DatabaseReader<AlineaDatabaseRecord>
      | DatabaseSnapshot<AlineaDatabaseRecord>
  ) {
    this.#reader =
      'schema' in source ? new SnapshotDatabaseReader(source) : source
    this.#loader = new EntryLoader(this.#reader)
    this.#cores = new EntryQueryEngine(this.#reader).find({status: 'all'})
  }

  get revision(): string {
    return this.#reader.revision
  }

  cores(): Promise<ReadonlyArray<EntryCoreRecord>> {
    return this.#cores
  }

  load(
    core: EntryCoreRecord,
    signal?: AbortSignal
  ): Promise<Entry | undefined> {
    return this.#loader.load(core, signal)
  }

  loadMany(
    cores: ReadonlyArray<EntryCoreRecord>,
    signal?: AbortSignal
  ): Promise<Array<Entry | undefined>> {
    return Promise.all(cores.map(core => this.load(core, signal)))
  }

  search(
    core: EntryCoreRecord,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ): Promise<EntrySearchRecord | undefined> {
    return this.#loader.search(core, audience, signal)
  }

  searchMany(
    cores: ReadonlyArray<EntryCoreRecord>,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ): Promise<Array<EntrySearchRecord | undefined>> {
    return Promise.all(cores.map(core => this.search(core, audience, signal)))
  }

  async *referencesTo(
    targetId: string,
    signal?: AbortSignal
  ): AsyncIterable<EntryLinkReference> {
    for await (const item of this.#reader.scan(
      referencesByTarget,
      targetId,
      signal
    ))
      yield item.metadata
  }

  async *referencesFrom(
    sourceId: string,
    signal?: AbortSignal
  ): AsyncIterable<EntryLinkReference> {
    for await (const item of this.#reader.scan(
      referencesBySource,
      sourceId,
      signal
    ))
      yield item.metadata
  }
}

export function isEntryStore(value: object): value is EntryStore {
  return 'cores' in value && typeof value.cores === 'function'
}
