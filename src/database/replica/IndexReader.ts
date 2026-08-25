import type {FrameLoader} from './Bundle.js'
import {
  DependencyTracker,
  indexDependency,
  recordDependency
} from './Dependency.js'
import type {QueryDependency} from './Dependency.js'
import type {
  IndexBucket,
  IndexKey,
  RecordId,
  RecordReference,
  ReplicaCatalog,
  Revision
} from './Types.js'

export interface ReplicaCodec<Data, Metadata = Record<string, unknown>> {
  decodeRecord(contents: Uint8Array, id: RecordId): Data
  decodeIndex(contents: Uint8Array, key: IndexKey): IndexBucket<Metadata>
}

export interface IndexReader<Data, Metadata = Record<string, unknown>> {
  readonly revision: Revision

  get(id: RecordId, signal?: AbortSignal): Promise<Data | undefined>

  scan(
    key: IndexKey,
    signal?: AbortSignal
  ): AsyncIterable<RecordReference<Metadata>>

  load(
    references: Iterable<RecordReference<Metadata>>,
    signal?: AbortSignal
  ): Promise<ReadonlyMap<RecordId, Data>>

  dependencies(): ReadonlySet<QueryDependency>
}

export class LazyIndexReader<
  Data,
  Metadata = Record<string, unknown>
> implements IndexReader<Data, Metadata> {
  #catalog: ReplicaCatalog
  #loader: FrameLoader
  #codec: ReplicaCodec<Data, Metadata>
  #tracker: DependencyTracker

  constructor(
    catalog: ReplicaCatalog,
    loader: FrameLoader,
    codec: ReplicaCodec<Data, Metadata>,
    tracker = new DependencyTracker()
  ) {
    this.#catalog = catalog
    this.#loader = loader
    this.#codec = codec
    this.#tracker = tracker
  }

  get revision(): Revision {
    return this.#catalog.revision
  }

  async get(id: RecordId, signal?: AbortSignal): Promise<Data | undefined> {
    this.#tracker.add(recordDependency(id))
    const frame = this.#catalog.records[id]
    if (!frame) return undefined
    const contents = await this.#loader.load(frame, signal)
    return this.#codec.decodeRecord(contents, id)
  }

  async *scan(
    key: IndexKey,
    signal?: AbortSignal
  ): AsyncIterable<RecordReference<Metadata>> {
    this.#tracker.add(indexDependency(key))
    const frame = this.#catalog.indexes[key]
    if (!frame) return
    const contents = await this.#loader.load(frame, signal)
    const bucket = this.#codec.decodeIndex(contents, key)
    for (const item of bucket.records) {
      signal?.throwIfAborted()
      const recordFrame = this.#catalog.records[item.id]
      if (!recordFrame) continue
      yield {id: item.id, frame: recordFrame, metadata: item.metadata}
    }
  }

  async load(
    references: Iterable<RecordReference<Metadata>>,
    signal?: AbortSignal
  ): Promise<ReadonlyMap<RecordId, Data>> {
    const source = Array.from(references)
    const values = await Promise.all(
      source.map(reference => this.get(reference.id, signal))
    )
    const result = new Map<RecordId, Data>()
    for (let index = 0; index < source.length; index++) {
      const value = values[index]
      if (value !== undefined) result.set(source[index].id, value)
    }
    return result
  }

  dependencies(): ReadonlySet<QueryDependency> {
    return this.#tracker.snapshot()
  }
}

export class JsonReplicaCodec<
  Data,
  Metadata = Record<string, unknown>
> implements ReplicaCodec<Data, Metadata> {
  #decoder = new TextDecoder()

  decodeRecord(contents: Uint8Array): Data {
    return JSON.parse(this.#decoder.decode(contents)) as Data
  }

  decodeIndex(contents: Uint8Array): IndexBucket<Metadata> {
    return JSON.parse(this.#decoder.decode(contents)) as IndexBucket<Metadata>
  }
}
