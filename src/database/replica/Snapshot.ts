import type {FrameLoader} from './Bundle.js'
import {diffCatalogs, type ReplicaChangeSet} from './Catalog.js'
import {
  LazyIndexReader,
  type IndexReader,
  type ReplicaCodec
} from './IndexReader.js'
import type {ReplicaCatalog, ReplicaState} from './Types.js'

export class ReplicaSnapshot<Data, Metadata = Record<string, unknown>> {
  readonly catalog: ReplicaCatalog
  readonly recordAccess: ReplicaState['recordAccess']
  #loader: FrameLoader
  #codec: ReplicaCodec<Data, Metadata>

  constructor(
    catalog: ReplicaCatalog,
    loader: FrameLoader,
    codec: ReplicaCodec<Data, Metadata>,
    recordAccess: ReplicaState['recordAccess'] = {}
  ) {
    this.catalog = catalog
    this.recordAccess = recordAccess
    this.#loader = loader
    this.#codec = codec
  }

  reader(): IndexReader<Data, Metadata> {
    return new LazyIndexReader(this.catalog, this.#loader, this.#codec)
  }

  access(id: string): 'explore' | 'read' | undefined {
    return this.recordAccess[id]
  }
}

export class ReplicaStore<Data, Metadata = Record<string, unknown>> {
  #current: ReplicaSnapshot<Data, Metadata>
  #listeners = new Set<(change: ReplicaChangeSet) => void>()

  constructor(initial: ReplicaSnapshot<Data, Metadata>) {
    this.#current = initial
  }

  snapshot(): ReplicaSnapshot<Data, Metadata> {
    return this.#current
  }

  install(next: ReplicaSnapshot<Data, Metadata>): ReplicaChangeSet {
    const change = diffCatalogs(this.#current.catalog, next.catalog)
    this.#current = next
    for (const listener of this.#listeners) listener(change)
    return change
  }

  subscribe(listener: (change: ReplicaChangeSet) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
