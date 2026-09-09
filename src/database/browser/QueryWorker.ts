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

export interface QueryGraph extends Graph {
  subscribe(query: GraphQuery, observer: QueryObserver): () => void
  readonly bootstrap?: IndexBootstrap
  refresh?(): Promise<boolean>
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

  bootstrap(): IndexBootstrap {
    if (this.#closed) throw new Error('Query worker is closed')
    const view = this.#runtime.bootstrap
    if (!view) throw new Error('Query graph has no authenticated bootstrap')
    return view
  }

  async refresh(): Promise<boolean> {
    if (this.#closed) throw new Error('Query worker is closed')
    if (!this.#runtime.refresh) throw new Error('Query graph cannot refresh')
    const changed = await this.#runtime.refresh()
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
