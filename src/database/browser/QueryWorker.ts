import {
  proxy,
  releaseProxy,
  finalizer,
  type Remote,
  type ProxyMarked
} from 'comlink'
import type {Graph, GraphQuery} from '#/core/Graph.js'
import {getScope} from '#/core/Scope.js'
import type {QueryObserver} from '../runtime/EntryRuntime.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import type {ConnectReplicaOptions} from './ReplicaSession.js'
import {
  WritableReplica,
  type WritableReplicaOptions
} from './WritableReplica.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {MutationContext} from '#/core/db/MutationContext.js'
import type {UploadMetadata} from '#/core/Connection.js'
import {IndexEvent, type IndexOp} from '#/core/db/IndexEvent.js'
import {ActivityEvent, type Activity} from '#/core/db/ActivityEvent.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'

export interface QueryGraph extends Graph {
  readonly events?: EventTarget
  referencesTo?(query: EntryReferenceQuery): Promise<EntryReferenceResult>
  subscribe(query: GraphQuery, observer: QueryObserver): () => void
  readonly bootstrap?: IndexBootstrap
  refresh?(): Promise<boolean>
  /** For change notifications: do not reuse a request started before the change. */
  refreshAfterChange?(): Promise<boolean>
  close?(purge?: boolean): void | Promise<void>
}

/** One port's query endpoint for an already configured, permission-scoped replica. */
export class QueryWorker {
  #runtime: QueryGraph
  #subscriptions = new Set<() => void>()
  #closed = false
  #owned: boolean
  #closing?: Promise<void>

  constructor(runtime: QueryGraph, options: {owned?: boolean} = {}) {
    this.#runtime = runtime
    this.#owned = options.owned ?? false
  }

  /** Call inside the worker, where config and authentication callbacks reside. */
  static async connect(options: ConnectReplicaOptions): Promise<QueryWorker> {
    const {LiveReplica} = await import('./LiveReplica.js')
    return new QueryWorker(await LiveReplica.connect(options), {owned: true})
  }

  static async connectWritable(
    options: WritableReplicaOptions
  ): Promise<QueryWorker> {
    return new QueryWorker(await WritableReplica.connect(options), {
      owned: true
    })
  }

  #writable(): WritableReplica {
    if (this.#closed) throw new Error('Query worker is closed')
    const runtime = this.#runtime
    if (!(runtime instanceof WritableReplica))
      throw new Error('Query graph is read-only')
    return runtime
  }

  mutationContext(): MutationContext {
    return this.#writable().mutationContext()
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    if (this.#closed) throw new Error('Query worker is closed')
    if (!this.#runtime.referencesTo)
      throw new Error('Query graph has no reference capability')
    const result = await this.#runtime.referencesTo(query)
    if (this.#closed) throw new Error('Query worker is closed')
    return result
  }

  async mutate(mutations: Array<Mutation>, expected?: MutationContext) {
    const result = await this.#writable().mutate(mutations, expected)
    if (this.#closed) throw new Error('Query worker is closed')
    return result
  }

  async pendingMutations() {
    const result = await this.#writable().pendingMutations()
    if (this.#closed) throw new Error('Query worker is closed')
    return result
  }

  async activities(): Promise<Array<Activity>> {
    const result = await this.#writable().activities()
    if (this.#closed) throw new Error('Query worker is closed')
    return result
  }

  async retryActivity(): Promise<void> {
    await this.#writable().retryActivity()
    if (this.#closed) throw new Error('Query worker is closed')
  }

  async discardActivity(): Promise<void> {
    await this.#writable().discardActivity()
    if (this.#closed) throw new Error('Query worker is closed')
  }

  listenActivity(
    observer: Remote<{next(activities: Array<Activity>): void} & ProxyMarked>
  ) {
    let runtime: WritableReplica
    try {
      runtime = this.#writable()
    } catch (error) {
      observer[releaseProxy]()
      throw error
    }
    let active = true
    const stop = () => {
      if (!active) return
      active = false
      runtime.events.removeEventListener(ActivityEvent.type, listen)
      this.#subscriptions.delete(stop)
      observer[releaseProxy]()
    }
    const listen = (event: Event) => {
      if (active && event instanceof ActivityEvent)
        void observer.next(event.activities).catch(stop)
    }
    runtime.events.addEventListener(ActivityEvent.type, listen)
    this.#subscriptions.add(stop)
    // activities() supplies initial state; do not race an async replay against
    // newer streamed events on another MessagePort.
    return proxy(stop)
  }

  async retryMutations(): Promise<void> {
    await this.#writable().retryMutations()
    if (this.#closed) throw new Error('Query worker is closed')
  }

  async discardMutation(id: string): Promise<void> {
    await this.#writable().discardMutation(id)
    if (this.#closed) throw new Error('Query worker is closed')
  }

  async prepareUpload(file: string, metadata?: UploadMetadata) {
    const result = await this.#writable().prepareUpload(file, metadata)
    if (this.#closed) throw new Error('Query worker is closed')
    return result
  }

  bootstrap(): IndexBootstrap {
    if (this.#closed) throw new Error('Query worker is closed')
    const view = this.#runtime.bootstrap
    if (!view) throw new Error('Query graph has no authenticated bootstrap')
    return view
  }

  listenIndex(observer: Remote<{next(event: IndexOp): void} & ProxyMarked>) {
    if (this.#closed || !this.#runtime.events) {
      observer[releaseProxy]()
      throw new Error('Query graph has no live index events')
    }
    const events = this.#runtime.events
    let active = true
    const stop = () => {
      if (!active) return
      active = false
      events.removeEventListener(IndexEvent.type, listen)
      this.#subscriptions.delete(stop)
      observer[releaseProxy]()
    }
    const listen = (event: Event) => {
      if (event instanceof IndexEvent && active)
        void observer.next(event.data).catch(stop)
    }
    events.addEventListener(IndexEvent.type, listen)
    this.#subscriptions.add(stop)
    try {
      const view = this.bootstrap()
      void observer
        .next({
          op: 'index',
          sha: view.revision,
          ids: [...new Set(view.entries.map(row => row.entry.id))]
        })
        .catch(stop)
    } catch (error) {
      stop()
      throw error
    }
    return proxy(stop)
  }

  async refresh(): Promise<boolean> {
    if (this.#closed) throw new Error('Query worker is closed')
    const refresh = this.#runtime.refreshAfterChange ?? this.#runtime.refresh
    if (!refresh) throw new Error('Query graph cannot refresh')
    const changed = await refresh.call(this.#runtime)
    if (this.#closed) throw new Error('Query worker is closed')
    return changed
  }

  #query(raw: string): GraphQuery {
    if (this.#closed) throw new Error('Query worker is closed')
    return getScope(this.#runtime.config).parse<GraphQuery>(raw)
  }

  async resolve(raw: string): Promise<unknown> {
    const value = await this.#runtime.resolve(this.#query(raw))
    if (this.#closed) throw new Error('Query worker is closed')
    return value
  }

  subscribe(raw: string, observer: Remote<QueryObserver & ProxyMarked>) {
    let query: GraphQuery
    try {
      query = this.#query(raw)
    } catch (error) {
      observer[releaseProxy]()
      throw error
    }
    let active = true
    const unsubscribe = () => {
      if (!active) return
      active = false
      stop()
      this.#subscriptions.delete(unsubscribe)
      observer[releaseProxy]()
    }
    let stop: () => void
    try {
      stop = this.#runtime.subscribe(query, {
        next(value) {
          void observer.next(value).catch(unsubscribe)
        },
        error(error) {
          void observer.error(error).catch(unsubscribe)
        }
      })
    } catch (error) {
      active = false
      observer[releaseProxy]()
      throw error
    }
    this.#subscriptions.add(unsubscribe)
    return proxy(unsubscribe)
  }

  /** Borrowed graphs survive port close; owned replicas drain and close with it. */
  async close(purge = false): Promise<void> {
    this.#closed = true
    for (const unsubscribe of this.#subscriptions) unsubscribe()
    if (!this.#closing)
      this.#closing = (async () => {
        if (this.#owned) await this.#runtime.close?.(purge)
      })()
    else if (purge && this.#owned)
      this.#closing = this.#closing.then(() => this.#runtime.close?.(true))
    await this.#closing
  }

  [finalizer](): void {
    void this.close().catch(() => {})
  }
}
