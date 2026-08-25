import type {IndexReader as ReplicaIndexReader} from './replica/IndexReader.js'
import type {DatabaseIndex, IndexedRecord} from './SecondaryIndex.js'
import type {DatabaseRecord, DatabaseSnapshot} from './Database.js'
import {
  DependencyTracker,
  indexDependency,
  recordDependency,
  type QueryDependency
} from './replica/Dependency.js'

export interface DatabaseReader<Row extends DatabaseRecord> {
  readonly revision: string

  get(id: string, signal?: AbortSignal): Promise<Row | undefined>

  scan<Metadata>(
    index: DatabaseIndex<Row, Metadata>,
    key: string,
    signal?: AbortSignal
  ): AsyncIterable<IndexedRecord<Metadata>>
}

export interface DecodedObjectCache<Row extends DatabaseRecord> {
  get(scope: string, revision: string, id: string): Promise<Row | undefined>
  put(scope: string, revision: string, id: string, value: Row): Promise<void>
}

export class CachedDatabaseReader<
  Row extends DatabaseRecord
> implements DatabaseReader<Row> {
  #source: DatabaseReader<Row>
  #cache: DecodedObjectCache<Row>
  #scope: string

  constructor(
    source: DatabaseReader<Row>,
    cache: DecodedObjectCache<Row>,
    scope: string
  ) {
    this.#source = source
    this.#cache = cache
    this.#scope = scope
  }

  get revision(): string {
    return this.#source.revision
  }

  async get(id: string, signal?: AbortSignal): Promise<Row | undefined> {
    signal?.throwIfAborted()
    const cached = await this.#cache.get(this.#scope, this.revision, id)
    if (cached) return cached
    const value = await this.#source.get(id, signal)
    if (value) await this.#cache.put(this.#scope, this.revision, id, value)
    return value
  }

  scan<Metadata>(
    index: DatabaseIndex<Row, Metadata>,
    key: string,
    signal?: AbortSignal
  ): AsyncIterable<IndexedRecord<Metadata>> {
    return this.#source.scan(index, key, signal)
  }
}

/** Tracks logical reads even when decoded values are served from cache. */
export class TrackedDatabaseReader<
  Row extends DatabaseRecord
> implements DatabaseReader<Row> {
  #source: DatabaseReader<Row>
  #tracker = new DependencyTracker()

  constructor(source: DatabaseReader<Row>) {
    this.#source = source
  }

  get revision(): string {
    return this.#source.revision
  }

  get(id: string, signal?: AbortSignal): Promise<Row | undefined> {
    this.#tracker.add(recordDependency(id))
    return this.#source.get(id, signal)
  }

  scan<Metadata>(
    index: DatabaseIndex<Row, Metadata>,
    key: string,
    signal?: AbortSignal
  ): AsyncIterable<IndexedRecord<Metadata>> {
    this.#tracker.add(indexDependency(replicaIndexKey(index.name, key)))
    return this.#source.scan(index, key, signal)
  }

  dependencies(): ReadonlySet<QueryDependency> {
    return this.#tracker.snapshot()
  }
}

export class SnapshotDatabaseReader<
  Row extends DatabaseRecord
> implements DatabaseReader<Row> {
  #snapshot: DatabaseSnapshot<Row>

  constructor(snapshot: DatabaseSnapshot<Row>) {
    this.#snapshot = snapshot
  }

  get revision(): string {
    return this.#snapshot.revision
  }

  async get(id: string, signal?: AbortSignal): Promise<Row | undefined> {
    signal?.throwIfAborted()
    return this.#snapshot.get(id)
  }

  async *scan<Metadata>(
    index: DatabaseIndex<Row, Metadata>,
    key: string,
    signal?: AbortSignal
  ): AsyncIterable<IndexedRecord<Metadata>> {
    for (const item of this.#snapshot.scan(index, key)) {
      signal?.throwIfAborted()
      yield item
    }
  }
}

/** Connects range-loaded replica indexes to the generic database query API. */
export class ReplicaDatabaseReader<
  Row extends DatabaseRecord
> implements DatabaseReader<Row> {
  #reader: ReplicaIndexReader<Row, unknown>

  constructor(reader: ReplicaIndexReader<Row, unknown>) {
    this.#reader = reader
  }

  get revision(): string {
    return this.#reader.revision
  }

  get(id: string, signal?: AbortSignal): Promise<Row | undefined> {
    return this.#reader.get(id, signal)
  }

  async *scan<Metadata>(
    index: DatabaseIndex<Row, Metadata>,
    key: string,
    signal?: AbortSignal
  ): AsyncIterable<IndexedRecord<Metadata>> {
    for await (const reference of this.#reader.scan(
      replicaIndexKey(index.name, key),
      signal
    )) {
      yield {
        id: reference.id,
        order: reference.order,
        metadata: reference.metadata as Metadata
      }
    }
  }
}

export function replicaIndexKey(index: string, key: string): string {
  return JSON.stringify([index, key])
}
