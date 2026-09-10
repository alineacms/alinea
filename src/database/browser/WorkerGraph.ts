import {proxy, releaseProxy, type Remote} from 'comlink'
import type {Config} from '#/core/Config.js'
import {type AnyQueryResult, type GraphQuery} from '#/core/Graph.js'
import {WritableGraph} from '#/core/db/WritableGraph.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {MutationContext} from '#/core/db/MutationContext.js'
import type {UploadMetadata} from '#/core/Connection.js'
import type {EntryReferenceQuery} from '#/core/db/EntryReference.js'
import {getScope} from '#/core/Scope.js'
import type {QueryObserver} from '../runtime/EntryRuntime.js'
import type {QueryWorker} from './QueryWorker.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import {CompiledPolicy} from './CompiledPolicy.js'

/** Keeps Graph expressions in their config scope when crossing a worker port. */
export class WorkerGraph extends WritableGraph {
  #worker: Remote<QueryWorker>
  #closed = false
  #pending = new Set<() => void>()
  #closing?: Promise<void>

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

  async mutate(mutations: Array<Mutation>, expected?: MutationContext) {
    this.#assertOpen()
    return this.#read(this.#worker.mutate(mutations, expected))
  }

  async pendingMutations() {
    this.#assertOpen()
    return this.#read(this.#worker.pendingMutations())
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

  /** Pass purge on logout before releasing this port. */
  async close(purge = false): Promise<void> {
    if (this.#closing) return this.#closing
    this.#closed = true
    for (const cancel of this.#pending) cancel()
    this.#pending.clear()
    this.#closing = (async () => {
      try {
        await this.#worker.close(purge)
      } finally {
        this.#worker[releaseProxy]()
      }
    })()
    return this.#closing
  }
}
