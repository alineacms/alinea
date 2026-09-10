import {proxy, releaseProxy, type Remote} from 'comlink'
import type {Config} from '#/core/Config.js'
import {type AnyQueryResult, type GraphQuery} from '#/core/Graph.js'
import {WritableGraph} from '#/core/db/WritableGraph.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {MutationContext} from '#/core/db/MutationContext.js'
import type {UploadMetadata} from '#/core/Connection.js'
import {IndexEvent, type IndexOp} from '#/core/db/IndexEvent.js'
import {ActivityEvent, type Activity} from '#/core/db/ActivityEvent.js'
import type {EntryReferenceQuery} from '#/core/db/EntryReference.js'
import {getScope} from '#/core/Scope.js'
import type {QueryObserver} from '../runtime/EntryRuntime.js'
import type {QueryWorker} from './QueryWorker.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import {CompiledPolicy} from './CompiledPolicy.js'

/** Keeps Graph expressions in their config scope when crossing a worker port. */
export class WorkerGraph extends WritableGraph {
  readonly events = new EventTarget()
  #worker: Remote<QueryWorker>
  #closed = false
  #failure?: Error
  #pending = new Set<() => void>()
  #queryErrors = new Set<(error: Error) => void>()
  #closing?: Promise<void>
  #eventStops = new Set<() => Promise<void>>()

  constructor(
    public config: Config,
    worker: Remote<QueryWorker>
  ) {
    super()
    this.#worker = worker
  }

  async mutationContext(): Promise<MutationContext> {
    this.#assertOpen()
    return this.#read(this.#worker.mutationContext())
  }

  /** Attach before mounting dashboard atoms; initial readiness is replayed. */
  async listenIndex(): Promise<() => Promise<void>> {
    this.#assertOpen()
    let active = true
    const unsubscribe = await this.#read(
      this.#worker.listenIndex(
        proxy({
          next: (event: IndexOp) => {
            if (active && !this.#closed)
              this.events.dispatchEvent(new IndexEvent(event))
          }
        })
      )
    )
    const stop = async () => {
      if (!active) return
      active = false
      this.#eventStops.delete(stop)
      try {
        if (!this.#failure) await this.#read(unsubscribe())
      } finally {
        unsubscribe[releaseProxy]()
      }
    }
    this.#eventStops.add(stop)
    if (this.#closed) {
      await stop()
      this.#assertOpen()
    }
    return stop
  }

  get sha(): Promise<string> {
    return this.bootstrap().then(view => view.revision)
  }

  async sync(): Promise<string> {
    await this.refresh()
    return this.sha
  }

  async mutate(mutations: Array<Mutation>, expected?: MutationContext) {
    this.#assertOpen()
    return this.#read(this.#worker.mutate(mutations, expected))
  }

  async pendingMutations() {
    this.#assertOpen()
    return this.#read(this.#worker.pendingMutations())
  }

  async activities(): Promise<Array<Activity>> {
    this.#assertOpen()
    return this.#read(this.#worker.activities())
  }

  async retryActivity(): Promise<void> {
    this.#assertOpen()
    await this.#read(this.#worker.retryActivity())
  }

  async discardActivity(): Promise<void> {
    this.#assertOpen()
    await this.#read(this.#worker.discardActivity())
  }

  async listenActivity(): Promise<() => Promise<void>> {
    this.#assertOpen()
    let active = true
    const unsubscribe = await this.#read(
      this.#worker.listenActivity(
        proxy({
          next: (activities: Array<Activity>) => {
            if (active && !this.#closed)
              this.events.dispatchEvent(new ActivityEvent(activities))
          }
        })
      )
    )
    const stop = async () => {
      if (!active) return
      active = false
      this.#eventStops.delete(stop)
      try {
        if (!this.#failure) await this.#read(unsubscribe())
      } finally {
        unsubscribe[releaseProxy]()
      }
    }
    this.#eventStops.add(stop)
    if (this.#closed) {
      await stop()
      this.#assertOpen()
    }
    return stop
  }

  async referencesTo(query: EntryReferenceQuery) {
    this.#assertOpen()
    return this.#read(this.#worker.referencesTo(query))
  }

  async retryMutations(): Promise<void> {
    this.#assertOpen()
    await this.#read(this.#worker.retryMutations())
  }

  async discardMutation(id: string): Promise<void> {
    this.#assertOpen()
    await this.#read(this.#worker.discardMutation(id))
  }

  async prepareUpload(file: string, metadata?: UploadMetadata) {
    this.#assertOpen()
    return this.#read(this.#worker.prepareUpload(file, metadata))
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
    const failed = (error: Error) => {
      if (active) observer.error(error)
    }
    this.#queryErrors.add(failed)
    let unsubscribe
    try {
      unsubscribe = await this.#read(
        this.#worker.subscribe(
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
      )
    } catch (error) {
      active = false
      this.#queryErrors.delete(failed)
      throw error
    }
    const stop = async () => {
      if (!active) return
      active = false
      this.#queryErrors.delete(failed)
      try {
        if (!this.#failure) await this.#read(unsubscribe())
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

  async bootstrap(): Promise<IndexBootstrap> {
    this.#assertOpen()
    const view = await this.#read(this.#worker.bootstrap())
    this.#assertOpen()
    return view
  }

  async refresh(): Promise<boolean> {
    this.#assertOpen()
    const changed = await this.#read(this.#worker.refresh())
    this.#assertOpen()
    return changed
  }

  async compiledPolicy(): Promise<CompiledPolicy> {
    return new CompiledPolicy(await this.bootstrap())
  }

  #assertOpen(): void {
    if (this.#failure) throw this.#failure
    if (this.#closed) throw new Error('Worker graph is closed')
  }

  /** A dead transport cannot acknowledge cleanup. Stop local delivery immediately. */
  protected fail(error: Error): void {
    if (this.#failure) return
    this.#failure = error
    const notify = !this.#closed
    this.#closed = true
    for (const cancel of this.#pending) cancel()
    this.#pending.clear()
    for (const failed of this.#queryErrors) {
      try {
        failed(error)
      } catch {}
    }
    this.#queryErrors.clear()
    if (notify)
      this.events.dispatchEvent(new IndexEvent({op: 'invalidate', error}))
  }

  #read<T>(request: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const cancel = () =>
        reject(this.#failure ?? new Error('Worker graph is closed'))
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
      if (this.#failure) {
        this.#pending.delete(cancel)
        cancel()
      }
    })
  }

  /** Pass purge on logout before releasing this port. */
  async close(purge = false): Promise<void> {
    if (this.#closing) return this.#closing
    this.#closed = true
    for (const cancel of this.#pending) cancel()
    this.#pending.clear()
    this.#queryErrors.clear()
    this.#closing = (async () => {
      try {
        try {
          await Promise.all([...this.#eventStops].map(stop => stop()))
        } finally {
          if (!this.#failure) await this.#read(this.#worker.close(purge))
        }
      } finally {
        this.#worker[releaseProxy]()
      }
    })()
    return this.#closing
  }
}
