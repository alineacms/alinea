import type {Config} from '#/core/Config.js'
import type {Graph} from '#/core/Graph.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {Policy} from '#/core/Role.js'
import type {Source} from '#/core/source/Source.js'
import {base64} from '#/core/util/Encoding.js'
import type {ReplicaBootstrap, ReplicaUser} from '../replica/Protocol.js'
import type {ReplicaState, Revision} from '../replica/Types.js'
import type {
  FieldTransaction,
  FieldTransactionResult
} from '../replica/Operations.js'
import {DatabaseResolver} from '../query/Resolver.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import {projectRuntimeDatabase} from '../runtime/Projection.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {prepareRuntimeFieldMutation} from './Mutation.js'
import {requestRuntimeSourceMutations} from './SourceWriter.js'
import {ReplicaRevisionLog} from './Deltas.js'
import {evaluateRolePolicy, roleFingerprint} from './Policy.js'

export interface AuthenticatedReplicaSession {
  user: ReplicaUser
  policy: Policy
  /** Stable for users whose combined role policies produce the same view. */
  policyFingerprint: string
}

export interface ReplicaServiceOptions {
  config: Config
  configId: string
  configUrl: string
  cacheKey: string
  runtime: RuntimeDatabaseIndex
  store: RuntimeEntryStore
  graph?: Graph
  mutate?: ReplicaMutationHandler
}

export interface ReplicaMutationHandler {
  (
    session: AuthenticatedReplicaSession,
    transaction: FieldTransaction
  ): Promise<FieldTransactionResult>
}

/** Framework-neutral authenticated read plane for the runtime database. */
export class ReplicaService {
  readonly revisions = new ReplicaRevisionLog()
  #configId: string
  #configUrl: string
  #cacheKey: string
  #runtime: RuntimeDatabaseIndex
  #store: RuntimeEntryStore
  #graph: Graph
  #config: Config
  #views = new Map<string, ReplicaState>()
  #mutate?: ReplicaMutationHandler
  #transactions = new Map<string, Promise<FieldTransactionResult>>()
  #bundles = new Map<string, Uint8Array>()

  constructor(options: ReplicaServiceOptions) {
    this.#configId = options.configId
    this.#config = options.config
    this.#configUrl = options.configUrl
    this.#cacheKey = options.cacheKey
    this.#runtime = options.runtime
    this.#store = options.store
    this.#graph =
      options.graph ?? new DatabaseResolver(options.config, options.store)
    this.#mutate = options.mutate
  }

  get revision(): string {
    return this.#runtime.revision
  }

  get runtimeIndex(): RuntimeDatabaseIndex {
    return this.#runtime
  }

  bootstrap(session: AuthenticatedReplicaSession): ReplicaBootstrap {
    return {
      user: session.user,
      configId: this.#configId,
      configUrl: this.#configUrl,
      cacheKey: this.#cacheKey,
      policy: session.policy.data()
    }
  }

  async session(user: ReplicaUser): Promise<AuthenticatedReplicaSession> {
    return {
      user,
      policy: await evaluateRolePolicy(this.#config, this.#graph, user.roles),
      policyFingerprint: roleFingerprint(user.roles)
    }
  }

  state(
    session: AuthenticatedReplicaSession,
    knownRevision?: Revision
  ): ReplicaState | undefined {
    if (knownRevision === this.revision) return
    const cacheKey = `${this.revision}\0${session.policyFingerprint}`
    let cached = this.#views.get(cacheKey)
    if (!cached) {
      cached = this.#runtimeState(session)
      this.#views.set(cacheKey, cached)
    }
    return cached
  }

  graph(): Graph {
    return this.#graph
  }

  cores() {
    return this.#runtime.entries
  }

  prepareFieldMutation(transaction: FieldTransaction, policy: Policy) {
    return prepareRuntimeFieldMutation(
      this.#store,
      this.#runtime.entries,
      transaction,
      policy
    )
  }

  requestSourceMutations(
    source: Source,
    mutations: ReadonlyArray<Mutation>,
    policy: Policy
  ): Promise<CommitRequest> {
    return requestRuntimeSourceMutations(
      this.#config,
      source,
      this.#store,
      this.#runtime,
      mutations,
      policy
    )
  }

  mutate(
    session: AuthenticatedReplicaSession,
    transaction: FieldTransaction
  ): Promise<FieldTransactionResult> {
    if (!this.#mutate)
      return Promise.reject(new Error('Replica mutations are not configured'))
    return this.mutateWith(session, transaction, this.#mutate)
  }

  mutateWith(
    session: AuthenticatedReplicaSession,
    transaction: FieldTransaction,
    handler: ReplicaMutationHandler
  ): Promise<FieldTransactionResult> {
    const key = `${session.user.id}\0${transaction.id}`
    let pending = this.#transactions.get(key)
    if (!pending) {
      pending = handler(session, transaction).catch(error => {
        this.#transactions.delete(key)
        throw error
      })
      this.#transactions.set(key, pending)
    }
    return pending
  }

  installRuntime(
    index: RuntimeDatabaseIndex,
    bundleId: string,
    contents: Uint8Array
  ): void {
    this.#bundles.set(bundleId, contents.slice())
    this.#store.install(index, url => this.#bundleSource(url, bundleId))
    this.#runtime = index
    this.#graph = new DatabaseResolver(this.#config, this.#store)
    this.#views.clear()
    this.revisions.publish(index.revision)
  }

  installRuntimeOverlay(
    index: RuntimeDatabaseIndex,
    bundleId: string,
    contents: Uint8Array
  ): void {
    this.installRuntime(index, bundleId, contents)
  }

  #bundleSource(url: string, fallback?: string) {
    const bundleId =
      new URL(url, 'http://alinea.local').searchParams.get('bundle') ?? fallback
    if (!bundleId)
      throw new Error(`Replica bundle URL has no bundle id: ${url}`)
    return {
      read: async (offset: number, length: number) =>
        this.bundle(bundleId, offset, length)
    }
  }

  bundle(bundleId: string, offset: number, length: number): Uint8Array {
    const contents = this.#bundles.get(bundleId)
    if (!contents) throw new Error(`Replica bundle "${bundleId}" was not found`)
    return contents.slice(offset, offset + length)
  }

  bundleSize(bundleId: string): number | undefined {
    return this.#bundles.get(bundleId)?.length
  }

  #runtimeState(session: AuthenticatedReplicaSession): ReplicaState {
    const view = projectRuntimeDatabase(this.#runtime, session.policy)
    const bundleIds = new Set<string>()
    for (const entry of view.index.entries) {
      for (const frame of [
        entry.frames?.data,
        entry.frames?.search,
        entry.frames?.references
      ])
        if (frame?.bundleId && this.#bundles.has(frame.bundleId))
          bundleIds.add(frame.bundleId)
    }
    return {
      viewId: session.policyFingerprint,
      recordAccess: view.access,
      recordEntries: Object.fromEntries(
        view.index.entries.map(entry => [entry.id, [entry.entryId]])
      ),
      runtime: view.index,
      inlineBundles: Object.fromEntries(
        [...bundleIds].map(bundleId => [
          bundleId,
          base64.stringify(this.#bundles.get(bundleId)!)
        ])
      )
    }
  }
}
