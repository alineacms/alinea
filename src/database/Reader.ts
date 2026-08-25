import type {IndexReader as ReplicaIndexReader} from './replica/IndexReader.js'
import type {DatabaseIndex, IndexedRecord} from './SecondaryIndex.js'
import type {DatabaseRecord, DatabaseSnapshot} from './Database.js'

export interface DatabaseReader<Row extends DatabaseRecord> {
  readonly revision: string

  get(id: string, signal?: AbortSignal): Promise<Row | undefined>

  scan<Metadata>(
    index: DatabaseIndex<Row, Metadata>,
    key: string,
    signal?: AbortSignal
  ): AsyncIterable<IndexedRecord<Metadata>>
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

export interface ReplicaIndexedMetadata<Metadata> {
  order: ReadonlyArray<boolean | number | string | null>
  metadata: Metadata
}

/** Connects range-loaded replica indexes to the generic database query API. */
export class ReplicaDatabaseReader<
  Row extends DatabaseRecord
> implements DatabaseReader<Row> {
  #reader: ReplicaIndexReader<Row, ReplicaIndexedMetadata<unknown>>

  constructor(
    reader: ReplicaIndexReader<Row, ReplicaIndexedMetadata<unknown>>
  ) {
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
      const projected = reference.metadata as ReplicaIndexedMetadata<Metadata>
      yield {
        id: reference.id,
        order: projected.order,
        metadata: projected.metadata
      }
    }
  }
}

export function replicaIndexKey(index: string, key: string): string {
  return JSON.stringify([index, key])
}
