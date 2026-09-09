import {proxy, releaseProxy, type Remote} from 'comlink'
import type {Config} from '#/core/Config.js'
import {Graph, type AnyQueryResult, type GraphQuery} from '#/core/Graph.js'
import {getScope} from '#/core/Scope.js'
import type {QueryObserver} from '../runtime/EntryRuntime.js'
import type {QueryWorker} from './QueryWorker.js'

/** Keeps Graph expressions in their config scope when crossing a worker port. */
export class WorkerGraph extends Graph {
  #worker: Remote<QueryWorker>
  #closed = false
  #pending = new Set<() => void>()

  constructor(
    public config: Config,
    worker: Remote<QueryWorker>
  ) {
    super()
    this.#worker = worker
  }

  async resolve<const Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    this.#assertOpen()
    const result = await this.#read(
      this.#worker.resolve(getScope(this.config).stringify(query))
    )
    this.#assertOpen()
    return result as AnyQueryResult<Query>
  }

  async subscribe(
    query: GraphQuery,
    observer: QueryObserver
  ): Promise<() => Promise<void>> {
    this.#assertOpen()
    let active = true
    const unsubscribe = await this.#worker.subscribe(
      getScope(this.config).stringify(query),
      proxy({
        next: (value: unknown) => {
          if (active && !this.#closed) observer.next(value)
        },
        error: (error: unknown) => {
          if (active && !this.#closed) observer.error(error)
        }
      })
    )
    const stop = async () => {
      if (!active) return
      active = false
      try {
        await unsubscribe()
      } finally {
        unsubscribe[releaseProxy]()
      }
    }
    if (this.#closed) {
      await stop()
      this.#assertOpen()
    }
    return stop
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error('Worker graph is closed')
  }

  #read<T>(request: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const cancel = () => reject(new Error('Worker graph is closed'))
      this.#pending.add(cancel)
      request.then(
        value => {
          this.#pending.delete(cancel)
          resolve(value)
        },
        error => {
          this.#pending.delete(cancel)
          reject(error)
        }
      )
    })
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    for (const cancel of this.#pending) cancel()
    this.#pending.clear()
    try {
      await this.#worker.close()
    } finally {
      this.#worker[releaseProxy]()
    }
  }
}
