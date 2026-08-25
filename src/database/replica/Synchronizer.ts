import type {ReplicaChangeSet} from './Catalog.js'
import type {ReplicaTransport} from './Protocol.js'
import {ReplicaSnapshot, ReplicaStore} from './Snapshot.js'
import type {ReplicaState, Revision} from './Types.js'

export interface ReplicaSnapshotFactory<
  Data,
  Metadata = Record<string, unknown>
> {
  create(
    state: ReplicaState,
    signal?: AbortSignal
  ): Promise<ReplicaSnapshot<Data, Metadata>>
}

export interface ReplicaSyncResult {
  revision: Revision
  changed: boolean
  change?: ReplicaChangeSet
}

export class ReplicaSynchronizer<Data, Metadata = Record<string, unknown>> {
  #transport: ReplicaTransport
  #store: ReplicaStore<Data, Metadata>
  #factory: ReplicaSnapshotFactory<Data, Metadata>
  #pending: Promise<ReplicaSyncResult> | undefined

  constructor(
    transport: ReplicaTransport,
    store: ReplicaStore<Data, Metadata>,
    factory: ReplicaSnapshotFactory<Data, Metadata>
  ) {
    this.#transport = transport
    this.#store = store
    this.#factory = factory
  }

  sync(signal?: AbortSignal): Promise<ReplicaSyncResult> {
    if (this.#pending) return this.#pending
    const pending = this.#sync(signal)
    this.#pending = pending
    void pending.finally(() => {
      if (this.#pending === pending) this.#pending = undefined
    })
    return pending
  }

  async #sync(signal?: AbortSignal): Promise<ReplicaSyncResult> {
    const current = this.#store.snapshot()
    const state = await this.#transport.state(current.catalog.revision, signal)
    if (!state) {
      return {revision: current.catalog.revision, changed: false}
    }
    const snapshot = await this.#factory.create(state, signal)
    const change = this.#store.install(snapshot)
    return {revision: snapshot.catalog.revision, changed: true, change}
  }
}
