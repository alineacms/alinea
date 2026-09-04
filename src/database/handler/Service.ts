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
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import {
  createRuntimeDeltaView,
  createRuntimeView
} from '../runtime/Projection.js'
import {
  RuntimeBundleCatalog,
  RuntimeSnapshot,
  type RuntimeDelta,
  type RuntimeDeltaArtifact
} from '../runtime/Snapshot.js'
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
  snapshot: RuntimeSnapshot
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
  #snapshot: RuntimeSnapshot
  #latestDelta?: RuntimeDelta
  #graph: Graph
  #config: Config
  #views = new Map<string, ReplicaState>()
  #policies = new Map<string, Promise<CachedPolicy>>()
  #transactions = new Map<string, TransactionCacheEntry>()
  #transactionCacheSize: number

  constructor(options: ReplicaServiceOptions) {
    this.#configId = options.configId
    this.#config = options.config
    this.#configUrl = options.configUrl
    this.#cacheKey = options.cacheKey
    this.#snapshot = options.snapshot
    this.#graph = options.graph ?? options.snapshot.resolver
    this.#transactionCacheSize = options.transactionCacheSize ?? 1024
    if (this.#transactionCacheSize < 1)
      throw new Error('Transaction cache size must be positive')
  }

  get revision(): string {
    return this.#snapshot.index.revision
  }

  get snapshot(): RuntimeSnapshot {
    return this.#snapshot
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
    const canApplyDelta =
      cursor?.viewId === session.policyFingerprint &&
      this.#latestDelta?.fromRevision === cursor.revision
    const cacheKey = `${this.revision}\0${session.policyFingerprint}\0${
      canApplyDelta ? cursor.revision : 'snapshot'
    }`
    let cached = this.#views.get(cacheKey)
    if (!cached) {
      cached = canApplyDelta
        ? this.#runtimeDelta(session, this.#latestDelta!)
        : this.#runtimeState(session)
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
    return this.#snapshot.index.entries
  }

  prepareFieldMutation(transaction: FieldTransaction, policy: Policy) {
    return prepareRuntimeFieldMutation(
      this.#config,
      this.#snapshot.store,
      this.#snapshot.index.entries,
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

  install(artifact: RuntimeDeltaArtifact): void {
    this.#snapshot = this.#snapshot.apply(artifact, {
      retainedBundleLimit: ReplicaService.retainedBundleLimit
    })
    this.#latestDelta = artifact.delta
    this.#graph = this.#snapshot.resolver
    this.#views.clear()
    this.#policies.clear()
  }

  bundle(bundleId: string, offset: number, length: number): Uint8Array {
    const contents = this.#snapshot.bundles.contents(bundleId)
    if (!contents) throw new Error(`Replica bundle "${bundleId}" was not found`)
    return contents.slice(offset, offset + length)
  }

  bundleSize(bundleId: string): number | undefined {
    return this.#snapshot.bundles.contents(bundleId)?.length
  }

  #runtimeState(session: AuthenticatedReplicaSession): ReplicaState {
    const view = createRuntimeView(this.#snapshot.index, session.policy)
    const compact = compactRuntimeBundles(
      view,
      session.policyFingerprint,
      this.#snapshot.bundles
    )
    return {
      viewId: session.policyFingerprint,
      runtime: compact.index,
      ...(Object.keys(compact.bundles).length > 0
        ? {inlineBundles: compact.bundles}
        : {})
    }
  }

  #runtimeDelta(
    session: AuthenticatedReplicaSession,
    delta: RuntimeDelta
  ): ReplicaState {
    const view = createRuntimeDeltaView(delta, session.policy)
    const changedEntries = view.entries.flatMap(change =>
      change.op === 'set' ? [change.entry] : []
    )
    const compact = compactRuntimeBundles(
      {
        ...this.#snapshot.index,
        entries: changedEntries,
        source: undefined,
        development: undefined
      },
      session.policyFingerprint,
      this.#snapshot.bundles
    )
    const compacted = new Map(
      compact.index.entries.map(entry => [entry.id, entry])
    )
    return {
      viewId: session.policyFingerprint,
      delta: {
        ...view,
        entries: view.entries.map(change =>
          change.op === 'set'
            ? {op: 'set', entry: compacted.get(change.entry.id)!}
            : change
        )
      },
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
  bundles: RuntimeBundleCatalog
): {index: RuntimeDatabaseIndex; bundles: Record<string, string>} {
  const grouped = new Map<string, Array<CompactFrame>>()
  for (const [entry, value] of index.entries.entries()) {
    for (const kind of ['data', 'search', 'references'] as const) {
      const frame = value.frames?.[kind]
      if (!frame?.bundleId || !bundles.contents(frame.bundleId)) continue
      const group = grouped.get(frame.bundleId) ?? []
      group.push({entry, kind, frame})
      grouped.set(frame.bundleId, group)
    }
  }
  if (grouped.size === 0) return {index, bundles: {}}

  const entries = [...index.entries]
  const encoded: Record<string, string> = {}
  for (const [bundleId, frames] of grouped) {
    const source = bundles.contents(bundleId)!
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
