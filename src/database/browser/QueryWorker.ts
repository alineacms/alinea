import {
  proxy,
  releaseProxy,
  finalizer,
  type Remote,
  type ProxyMarked
} from 'comlink'
import type {GraphQuery} from '#/core/Graph.js'
import {getScope} from '#/core/Scope.js'
import type {EntryRuntime, QueryObserver} from '../runtime/EntryRuntime.js'

/** One port's query endpoint for an already configured, permission-scoped replica. */
export class QueryWorker {
  #runtime: EntryRuntime
  #subscriptions = new Set<() => void>()
  #closed = false

  constructor(runtime: EntryRuntime) {
    this.#runtime = runtime
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
    const stop = this.#runtime.subscribe(query, {
      next(value) {
        void observer.next(value).catch(unsubscribe)
      },
      error(error) {
        void observer.error(error).catch(unsubscribe)
      }
    })
    this.#subscriptions.add(unsubscribe)
    return proxy(unsubscribe)
  }

  /** Stops observers; the owner closes the connection after pending work settles. */
  close(): void {
    this.#closed = true
    for (const unsubscribe of this.#subscriptions) unsubscribe()
  }

  [finalizer](): void {
    this.close()
  }
}
