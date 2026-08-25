import {dependenciesIntersect} from './Dependency.js'
import type {IndexReader} from './IndexReader.js'
import {ReplicaStore} from './Snapshot.js'

export interface QueryResolver<
  Query,
  Result,
  Data,
  Metadata = Record<string, unknown>
> {
  resolve(
    query: Query,
    reader: IndexReader<Data, Metadata>,
    signal: AbortSignal
  ): Promise<Result>
}

export interface LiveQueryOptions<Result> {
  equal?(previous: Result, next: Result): boolean
  onError?(error: unknown): void
}

export interface LiveQuerySubscription {
  ready: Promise<void>
  unsubscribe(): void
}

export class LiveQueryManager<
  Query,
  Result,
  Data,
  Metadata = Record<string, unknown>
> {
  #store: ReplicaStore<Data, Metadata>
  #resolver: QueryResolver<Query, Result, Data, Metadata>

  constructor(
    store: ReplicaStore<Data, Metadata>,
    resolver: QueryResolver<Query, Result, Data, Metadata>
  ) {
    this.#store = store
    this.#resolver = resolver
  }

  subscribe(
    query: Query,
    receive: (result: Result) => void,
    options: LiveQueryOptions<Result> = {}
  ): LiveQuerySubscription {
    return new ManagedLiveQuery(
      this.#store,
      this.#resolver,
      query,
      receive,
      options
    )
  }
}

class ManagedLiveQuery<
  Query,
  Result,
  Data,
  Metadata = Record<string, unknown>
> implements LiveQuerySubscription {
  ready: Promise<void>
  #store: ReplicaStore<Data, Metadata>
  #resolver: QueryResolver<Query, Result, Data, Metadata>
  #query: Query
  #receive: (result: Result) => void
  #options: LiveQueryOptions<Result>
  #dependencies = new Set<string>()
  #result: Result | undefined
  #hasResult = false
  #generation = 0
  #scheduled = false
  #closed = false
  #abort: AbortController | undefined
  #stop: () => void
  #resolveReady!: () => void
  #rejectReady!: (error: unknown) => void
  #initial = true

  constructor(
    store: ReplicaStore<Data, Metadata>,
    resolver: QueryResolver<Query, Result, Data, Metadata>,
    query: Query,
    receive: (result: Result) => void,
    options: LiveQueryOptions<Result>
  ) {
    this.#store = store
    this.#resolver = resolver
    this.#query = query
    this.#receive = receive
    this.#options = options
    this.ready = new Promise((resolve, reject) => {
      this.#resolveReady = resolve
      this.#rejectReady = reject
    })
    this.#stop = store.subscribe(change => {
      if (
        !this.#hasResult ||
        dependenciesIntersect(this.#dependencies, change.dependencies)
      ) {
        this.#schedule()
      }
    })
    this.#schedule()
  }

  unsubscribe(): void {
    if (this.#closed) return
    this.#closed = true
    this.#generation += 1
    this.#abort?.abort()
    this.#stop()
  }

  #schedule(): void {
    if (this.#closed) return
    this.#generation += 1
    this.#abort?.abort()
    if (this.#scheduled) return
    this.#scheduled = true
    queueMicrotask(() => {
      this.#scheduled = false
      if (!this.#closed) void this.#evaluate(this.#generation)
    })
  }

  async #evaluate(generation: number): Promise<void> {
    const snapshot = this.#store.snapshot()
    const reader = snapshot.reader()
    const abort = new AbortController()
    this.#abort = abort
    try {
      const result = await this.#resolver.resolve(
        this.#query,
        reader,
        abort.signal
      )
      if (this.#closed || generation !== this.#generation) return
      this.#dependencies = new Set(reader.dependencies())
      const equal = this.#options.equal ?? Object.is
      if (!this.#hasResult || !equal(this.#result as Result, result)) {
        this.#result = result
        this.#hasResult = true
        this.#receive(result)
      }
      if (this.#initial) {
        this.#initial = false
        this.#resolveReady()
      }
    } catch (error) {
      if (this.#closed || generation !== this.#generation) return
      if (this.#initial) {
        this.#initial = false
        this.#rejectReady(error)
      }
      this.#options.onError?.(error)
    }
  }
}
