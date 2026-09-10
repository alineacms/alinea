import {Client} from '#/core/Client.js'
import type {UploadMetadata} from '#/core/Connection.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {MutationContext} from '#/core/db/MutationContext.js'
import {WritableGraph} from '#/core/db/WritableGraph.js'
import type {QueryObserver} from '../runtime/EntryRuntime.js'
import {CompiledPolicy} from './CompiledPolicy.js'
import {LiveReplica} from './LiveReplica.js'
import {MutationQueue, type MutationQueueLock} from './MutationQueue.js'
import {PendingMutations} from './PendingMutations.js'
import type {ConnectReplicaOptions} from './ReplicaSession.js'

export interface WritableReplicaOptions extends ConnectReplicaOptions {
  indexedDB: IDBFactory
  lock?: MutationQueueLock
}

/** A writable Graph backed by authenticated SQL reads and durable source intents.
 * Saves resolve only after the ready replica refresh, never against a speculative
 * local source tree. The caller drives polling and explicit recovery of drafts.
 */
export class WritableReplica extends WritableGraph {
  readonly config: WritableReplicaOptions['config']
  #replica: LiveReplica
  #queue: MutationQueue
  #client: Client
  #closed = false
  #closing?: Promise<void>

  private constructor(
    replica: LiveReplica,
    queue: MutationQueue,
    client: Client
  ) {
    super()
    this.config = replica.config
    this.#replica = replica
    this.#queue = queue
    this.#client = client
  }

  static async connect(
    options: WritableReplicaOptions
  ): Promise<WritableReplica> {
    const replica = await LiveReplica.connect(options)
    let store: PendingMutations | undefined
    try {
      const {project, namespace, epoch, principal} = replica.identity
      const scope = {
        project,
        namespace,
        epoch,
        principal,
        endpoint: options.url
      }
      store = await PendingMutations.open(options.indexedDB, scope)
      options.signal?.throwIfAborted()
      const client = new Client({
        config: options.config,
        url: options.url,
        applyAuth: options.applyAuth
          ? init => options.applyAuth!(init ?? {})
          : undefined,
        fetch: options.fetch
          ? (url, init) => options.fetch!(String(url), init ?? {})
          : undefined
      })
      const queue = new MutationQueue({
        scope,
        store,
        replica,
        client,
        lock: options.lock
      })
      return new WritableReplica(replica, queue, client)
    } catch (error) {
      store?.close()
      await replica.close()
      throw error
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error('Writable replica is closed')
  }

  get bootstrap() {
    this.#assertOpen()
    return this.#replica.bootstrap
  }

  /** Capture when authoring starts; pass it back for structural saves. */
  mutationContext(): MutationContext {
    const {identity, revision} = this.bootstrap
    const {project, namespace, epoch, principal, schemaId, configId} = identity
    return {
      project,
      namespace,
      epoch,
      principal,
      schemaId,
      configId,
      baseRevision: revision
    }
  }

  async mutate(
    mutations: Array<Mutation>,
    expected = this.mutationContext()
  ): Promise<{id: string; sha: string}> {
    this.#assertOpen()
    const current = this.mutationContext()
    for (const key of ['project', 'namespace', 'epoch', 'principal'] as const)
      if (expected[key] !== current[key])
        throw new Error('Mutation context belongs to another replica scope')
    const id = createId()
    await this.#queue.enqueue({
      id,
      mutations,
      baseRevision: expected.baseRevision,
      schemaId: expected.schemaId,
      configId: expected.configId
    })
    await this.#queue.flush()
    this.#assertOpen()
    return {id, sha: this.bootstrap.revision}
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    this.#assertOpen()
    return this.#replica.resolve(query)
  }

  subscribe(query: GraphQuery, observer: QueryObserver): () => void {
    this.#assertOpen()
    return this.#replica.subscribe(query, observer)
  }

  async compiledPolicy(): Promise<CompiledPolicy> {
    return new CompiledPolicy(this.bootstrap)
  }

  refresh(): Promise<boolean> {
    this.#assertOpen()
    return this.#replica.refresh()
  }

  pendingMutations() {
    this.#assertOpen()
    return this.#queue.list()
  }

  retryMutations(): Promise<void> {
    this.#assertOpen()
    return this.#queue.flush()
  }

  discardMutation(id: string): Promise<void> {
    this.#assertOpen()
    return this.#queue.discard(id)
  }

  prepareUpload(file: string, metadata?: UploadMetadata) {
    this.#assertOpen()
    return this.#client.prepareUpload(file, metadata)
  }

  /** Logout must request purge before this owner is closed/released. */
  close(purge = false): Promise<void> {
    if (this.#closing) return this.#closing
    this.#closed = true
    this.#closing = Promise.allSettled([
      this.#queue.close({purge}),
      this.#replica.close(purge)
    ]).then(results => {
      const failed = results.find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
    })
    return this.#closing
  }
}
