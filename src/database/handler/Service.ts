import type {Config} from '#/core/Config.js'
import type {Graph} from '#/core/Graph.js'
import type {Policy} from '#/core/Role.js'
import {base64} from '#/core/util/Encoding.js'
import {assert} from '#/core/util/Assert.js'
import type {
  ReplicaBootstrap,
  ReplicaCursor,
  ReplicaUser
} from '../replica/Protocol.js'
import type {ReplicaState} from '../replica/Types.js'
import type {
  FieldTransaction,
  FieldTransactionResult
} from '../replica/Operations.js'
import {DatabaseResolver} from '../query/Resolver.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import {createRuntimeView} from '../runtime/Projection.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {prepareRuntimeFieldMutation} from './Mutation.js'
import {evaluateRolePolicy, policyFingerprint} from './Policy.js'

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
  transactionCacheSize?: number
}

export interface ReplicaMutationHandler {
  (
    session: AuthenticatedReplicaSession,
    transaction: FieldTransaction
  ): Promise<FieldTransactionResult>
}

/** Framework-neutral authenticated read plane for the runtime database. */
export class ReplicaService {
  static readonly retainedBundleLimit = 2
  static readonly viewCacheLimit = 32
  #configId: string
  #configUrl: string
  #cacheKey: string
  #runtime: RuntimeDatabaseIndex
  #store: RuntimeEntryStore
  #graph: Graph
  #config: Config
  #views = new Map<string, ReplicaState>()
  #policies = new Map<string, Promise<CachedPolicy>>()
  #transactions = new Map<string, TransactionCacheEntry>()
  #transactionCacheSize: number
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
    this.#transactionCacheSize = options.transactionCacheSize ?? 1024
    if (this.#transactionCacheSize < 1)
      throw new Error('Transaction cache size must be positive')
  }

  get revision(): string {
    return this.#runtime.revision
  }

  get runtimeIndex(): RuntimeDatabaseIndex {
    return this.#runtime
  }

  get runtimeStore(): RuntimeEntryStore {
    return this.#store
  }

  bootstrap(session: AuthenticatedReplicaSession): ReplicaBootstrap {
    return {
      user: session.user,
      viewId: session.policyFingerprint,
      configId: this.#configId,
      configUrl: this.#configUrl,
      cacheKey: JSON.stringify([
        this.#cacheKey,
        session.user.id,
        session.policyFingerprint
      ]),
      policy: session.policy.data()
    }
  }

  async session(user: ReplicaUser): Promise<AuthenticatedReplicaSession> {
    const revision = this.revision
    const roles = [...new Set(user.roles)].sort()
    const key = JSON.stringify(roles)
    let pending = this.#policies.get(key)
    if (!pending) {
      pending = (async () => {
        const policy = await evaluateRolePolicy(
          this.#config,
          this.#graph,
          roles
        )
        return {policy, fingerprint: await policyFingerprint(policy)}
      })()
      if (this.#policies.size >= ReplicaService.viewCacheLimit)
        this.#policies.delete(this.#policies.keys().next().value!)
      this.#policies.set(key, pending)
      void pending.catch(() => {
        if (this.#policies.get(key) === pending) this.#policies.delete(key)
      })
    }
    const {policy, fingerprint} = await pending
    if (this.revision !== revision) return this.session(user)
    return {
      user,
      policy,
      policyFingerprint: fingerprint
    }
  }

  state(
    session: AuthenticatedReplicaSession,
    cursor?: ReplicaCursor
  ): ReplicaState | undefined {
    if (
      cursor?.revision === this.revision &&
      cursor.viewId === session.policyFingerprint
    )
      return
    const cacheKey = `${this.revision}\0${session.policyFingerprint}`
    let cached = this.#views.get(cacheKey)
    if (!cached) {
      cached = this.#runtimeState(session)
      if (this.#views.size >= ReplicaService.viewCacheLimit)
        this.#views.delete(this.#views.keys().next().value!)
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
      this.#config,
      this.#store,
      this.#runtime.entries,
      transaction,
      policy
    )
  }

  mutateWith(
    session: AuthenticatedReplicaSession,
    transaction: FieldTransaction,
    handler: ReplicaMutationHandler
  ): Promise<FieldTransactionResult> {
    const key = JSON.stringify([session.user.id, transaction.id])
    const cached = this.#transactions.get(key)
    if (cached) return cached.promise
    const pending = handler(session, transaction)
    const entry: TransactionCacheEntry = {promise: pending, settled: false}
    this.#transactions.set(key, entry)
    this.#pruneTransactions()
    void pending.then(
      () => {
        entry.settled = true
        this.#pruneTransactions()
      },
      () => this.#transactions.delete(key)
    )
    return pending
  }

  #pruneTransactions(): void {
    while (this.#transactions.size > this.#transactionCacheSize) {
      const settled = [...this.#transactions].find(([, entry]) => entry.settled)
      if (!settled) return
      this.#transactions.delete(settled[0])
    }
  }

  installRuntime(
    index: RuntimeDatabaseIndex,
    bundleId: string,
    contents: Uint8Array
  ): void {
    this.#bundles.set(bundleId, contents.slice())
    this.#store.install(index, url => this.#bundleSource(url, bundleId))
    this.#runtime = index
    this.#pruneBundles()
    this.#graph = new DatabaseResolver(this.#config, this.#store)
    this.#views.clear()
    this.#policies.clear()
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

  #pruneBundles(): void {
    const live = runtimeBundleIds(this.#runtime)
    const retired = [...this.#bundles.keys()].filter(
      bundleId => !live.has(bundleId)
    )
    while (retired.length > ReplicaService.retainedBundleLimit)
      this.#bundles.delete(retired.shift()!)
  }

  #runtimeState(session: AuthenticatedReplicaSession): ReplicaState {
    const view = createRuntimeView(this.#runtime, session.policy)
    const compact = compactRuntimeBundles(
      view,
      session.policyFingerprint,
      this.#bundles
    )
    return {
      viewId: session.policyFingerprint,
      runtime: compact.index,
      ...(Object.keys(compact.bundles).length > 0
        ? {inlineBundles: compact.bundles}
        : {})
    }
  }
}

interface TransactionCacheEntry {
  promise: Promise<FieldTransactionResult>
  settled: boolean
}

interface CachedPolicy {
  policy: Policy
  fingerprint: string
}

function runtimeBundleIds(index: RuntimeDatabaseIndex): ReadonlySet<string> {
  const result = new Set<string>()
  const add = (frame: {bundleId?: string} | undefined) => {
    if (frame?.bundleId) result.add(frame.bundleId)
  }
  for (const entry of index.entries) {
    add(entry.frames?.data)
    add(entry.frames?.search)
    add(entry.frames?.references)
  }
  add(index.source?.treeFrame.frame)
  return result
}

type FrameKind = 'data' | 'search' | 'references'

interface CompactFrame {
  entry: number
  kind: FrameKind
  frame: NonNullable<
    NonNullable<RuntimeDatabaseIndex['entries'][number]['frames']>['data']
  >
}

function compactRuntimeBundles(
  index: RuntimeDatabaseIndex,
  viewId: string,
  bundles: ReadonlyMap<string, Uint8Array>
): {index: RuntimeDatabaseIndex; bundles: Record<string, string>} {
  const grouped = new Map<string, Array<CompactFrame>>()
  for (const [entry, value] of index.entries.entries()) {
    for (const kind of ['data', 'search', 'references'] as const) {
      const frame = value.frames?.[kind]
      if (!frame?.bundleId || !bundles.has(frame.bundleId)) continue
      const group = grouped.get(frame.bundleId) ?? []
      group.push({entry, kind, frame})
      grouped.set(frame.bundleId, group)
    }
  }
  if (grouped.size === 0) return {index, bundles: {}}

  const entries = [...index.entries]
  const encoded: Record<string, string> = {}
  for (const [bundleId, frames] of grouped) {
    const source = bundles.get(bundleId)!
    const length = frames.reduce((total, {frame}) => total + frame.length, 0)
    const contents = new Uint8Array(length)
    let offset = 0
    for (const {entry, kind, frame} of frames) {
      assert(
        frame.offset >= 0 && frame.offset + frame.length <= source.length,
        `Frame range escapes replica bundle "${bundleId}"`
      )
      contents.set(
        source.subarray(frame.offset, frame.offset + frame.length),
        offset
      )
      const current = entries[entry]
      const currentFrames = current.frames!
      entries[entry] = {
        ...current,
        frames: {
          ...currentFrames,
          [kind]: {
            ...frame,
            offset,
            bundleUrl: inlineBundleUrl(
              frame.bundleUrl ?? index.bundleUrl,
              index.revision,
              viewId
            )
          }
        }
      }
      offset += frame.length
    }
    encoded[bundleId] = base64.stringify(contents)
  }
  return {index: {...index, entries}, bundles: encoded}
}

function inlineBundleUrl(
  url: string,
  revision: string,
  viewId: string
): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}inline=${encodeURIComponent(`${revision}:${viewId}`)}`
}
