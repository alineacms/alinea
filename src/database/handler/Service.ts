import type {DatabaseSnapshot} from '../Database.js'
import type {Config} from '#/core/Config.js'
import type {Graph} from '#/core/Graph.js'
import type {Policy} from '#/core/Role.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'
import type {HandlerKeyCatalog} from '../release/Exporter.js'
import type {ReplicaBootstrap, ReplicaUser} from '../replica/Protocol.js'
import type {ReplicaCatalog, ReplicaState, Revision} from '../replica/Types.js'
import type {
  FieldTransaction,
  FieldTransactionResult
} from '../replica/Operations.js'
import {ReplicaRevisionLog} from './Deltas.js'
import {projectEntryReplicaState} from './EntryProjection.js'
import {evaluateRolePolicy, roleFingerprint} from './Policy.js'
import {DatabaseResolver} from '../query/Resolver.js'
import type {RuntimeDatabaseIndex, RuntimeIndexEntry} from '../runtime/Model.js'
import {projectRuntimeDatabase} from '../runtime/Projection.js'
import {isEntryCoreRecord} from '../entry/Model.js'
import type {EntryStore} from '../entry/Store.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {prepareFieldMutation, prepareRuntimeFieldMutation} from './Mutation.js'
import {requestRuntimeSourceUpdates} from './SourceWriter.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Source} from '#/core/source/Source.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {base64} from '#/core/util/Encoding.js'

export interface ReplicaRelease {
  snapshot: DatabaseSnapshot<AlineaDatabaseRecord>
  catalog: ReplicaCatalog
  keys: HandlerKeyCatalog
}

export interface AuthenticatedReplicaSession {
  user: ReplicaUser
  policy: Policy
  /** Stable for users whose combined role policies produce the same view. */
  policyFingerprint: string
}

export interface ReplicaServiceOptions {
  config?: Config
  configId: string
  configUrl: string
  cacheKey: string
  release?: ReplicaRelease
  runtime?: RuntimeDatabaseIndex
  store?: EntryStore
  graph?: Graph
  mutate?: ReplicaMutationHandler
}

export interface ReplicaMutationHandler {
  (
    session: AuthenticatedReplicaSession,
    transaction: FieldTransaction
  ): Promise<FieldTransactionResult>
}

/** Framework-neutral authenticated read plane used by HTTP handler adapters. */
export class ReplicaService {
  readonly revisions = new ReplicaRevisionLog()
  #configId: string
  #configUrl: string
  #cacheKey: string
  #release?: ReplicaRelease
  #runtime?: RuntimeDatabaseIndex
  #store?: EntryStore
  #graph?: Graph
  #config?: Config
  #views = new Map<string, ReplicaState>()
  #mutate?: ReplicaMutationHandler
  #transactions = new Map<string, Promise<FieldTransactionResult>>()
  #bundles = new Map<string, Uint8Array>()

  constructor(options: ReplicaServiceOptions) {
    this.#configId = options.configId
    this.#config = options.config
    this.#configUrl = options.configUrl
    this.#cacheKey = options.cacheKey
    this.#release = options.release
    this.#runtime = options.runtime
    this.#store = options.store
    this.#graph = options.graph
    this.#mutate = options.mutate
    if (!this.#release && !this.#runtime)
      throw new Error('Replica service requires a release or runtime index')
  }

  get release(): ReplicaRelease {
    if (!this.#release) throw new Error('Normalized replica is not loaded')
    return this.#release
  }

  get revision(): string {
    return this.#runtime?.revision ?? this.release.snapshot.revision
  }

  get runtimeIndex(): RuntimeDatabaseIndex | undefined {
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
    if (!this.#config)
      throw new Error('Replica role evaluation requires handler config')
    const graph =
      this.#graph ?? new DatabaseResolver(this.#config, this.release.snapshot)
    return {
      user,
      policy: await evaluateRolePolicy(this.#config, graph, user.roles),
      policyFingerprint: roleFingerprint(user.roles)
    }
  }

  state(
    session: AuthenticatedReplicaSession,
    knownRevision?: Revision
  ): ReplicaState | undefined {
    if (knownRevision === this.revision) return undefined
    const cacheKey = `${this.revision}\0${session.policyFingerprint}`
    let cached = this.#views.get(cacheKey)
    if (!cached) {
      cached = this.#runtime
        ? this.#runtimeState(session)
        : projectEntryReplicaState({
            viewId: session.policyFingerprint,
            policy: session.policy,
            snapshot: this.release.snapshot,
            catalog: this.release.catalog,
            keys: this.release.keys
          })
      this.#views.set(cacheKey, cached)
    }
    return cached
  }

  object(
    session: AuthenticatedReplicaSession,
    id: string
  ): AlineaDatabaseRecord | undefined {
    const state = this.state(session)
    if (!state?.catalog.records[id]) return undefined
    return this.#release?.snapshot.get(id)
  }

  graph(): Graph {
    if (this.#graph) return this.#graph
    if (!this.#config)
      throw new Error('Replica query resolution requires handler config')
    return new DatabaseResolver(this.#config, this.release.snapshot)
  }

  cores(): ReadonlyArray<import('../entry/Model.js').EntryCoreRecord> {
    if (this.#runtime) return this.#runtime.entries
    return [...this.release.snapshot.records()].filter(isEntryCoreRecord)
  }

  async prepareFieldMutation(
    transaction: FieldTransaction,
    policy: Policy
  ): Promise<import('./Mutation.js').PreparedFieldMutation> {
    if (this.#runtime) {
      if (!this.#store)
        throw new Error('Runtime replica mutation store is not configured')
      return prepareRuntimeFieldMutation(
        this.#store,
        this.#runtime.entries,
        transaction,
        policy
      )
    }
    return prepareFieldMutation(this.release.snapshot, transaction, policy)
  }

  async requestSourceUpdates(
    source: Source,
    mutations: ReadonlyArray<Mutation>,
    policy: Policy
  ): Promise<CommitRequest | undefined> {
    if (!this.#runtime || !this.#store || !this.#config) return
    return requestRuntimeSourceUpdates(
      this.#config,
      source,
      this.#store,
      this.#runtime.entries,
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

  install(release: ReplicaRelease): void {
    this.#release = release
    this.#runtime = undefined
    this.#store = undefined
    this.#graph = undefined
    this.#views.clear()
    this.revisions.publish(release.catalog.revision)
  }

  installOverlay(
    release: ReplicaRelease,
    bundleId: string,
    contents: Uint8Array
  ): void {
    this.#bundles.set(bundleId, contents.slice())
    this.install(release)
  }

  installRuntime(
    index: RuntimeDatabaseIndex,
    bundleId: string,
    contents: Uint8Array
  ): void {
    this.#bundles.set(bundleId, contents.slice())
    const store =
      this.#store instanceof RuntimeEntryStore
        ? this.#store
        : new RuntimeEntryStore({
            index,
            source: url => this.#bundleSource(url, bundleId)
          })
    store.install(index, url => this.#bundleSource(url, bundleId))
    this.#release = undefined
    this.#runtime = index
    this.#store = store
    if (this.#config) this.#graph = new DatabaseResolver(this.#config, store)
    this.#views.clear()
    this.revisions.publish(index.revision)
  }

  installRuntimeOverlay(
    index: RuntimeDatabaseIndex,
    bundleId: string,
    contents: Uint8Array
  ): void {
    this.installRuntimeOverlays(index, [{bundleId, contents}])
  }

  installRuntimeOverlays(
    index: RuntimeDatabaseIndex,
    bundles: ReadonlyArray<{
      bundleId: string
      contents: Uint8Array
      entry?: RuntimeIndexEntry
      plaintext?: Uint8Array
    }>
  ): void {
    if (!(this.#store instanceof RuntimeEntryStore))
      throw new Error('Runtime overlay requires a runtime entry store')
    for (const {bundleId, contents} of bundles)
      this.#bundles.set(bundleId, contents.slice())
    this.#store.install(index, url => this.#bundleSource(url))
    for (const {entry, plaintext} of bundles)
      if (entry && plaintext) this.#store.prime(entry, plaintext)
    this.#runtime = index
    if (this.#config)
      this.#graph = new DatabaseResolver(this.#config, this.#store)
    this.#views.clear()
    this.revisions.publish(index.revision)
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
    const view = projectRuntimeDatabase(this.#runtime!, session.policy)
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
    const inlineBundles = Object.fromEntries(
      [...bundleIds].map(bundleId => [
        bundleId,
        base64.stringify(this.#bundles.get(bundleId)!)
      ])
    )
    return {
      viewId: session.policyFingerprint,
      catalog: {
        version: 1,
        bundleId: view.index.bundleId,
        bundleUrl: view.index.bundleUrl,
        revision: view.index.revision,
        records: {},
        indexes: {}
      },
      grants: [],
      recordAccess: view.access,
      recordEntries: Object.fromEntries(
        view.index.entries.map(entry => [entry.id, [entry.entryId]])
      ),
      runtime: view.index,
      inlineBundles
    }
  }
}
