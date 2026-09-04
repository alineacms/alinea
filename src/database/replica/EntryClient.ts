import type {Config} from '#/core/Config.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {RuntimeSnapshot, runtimeDeltaEntryIds} from '../runtime/Snapshot.js'
import {HttpRangeSource} from './HttpTransport.js'
import {IndexedDBReplicaCache} from './IndexedDBCache.js'
import type {ReplicaBootstrap, ReplicaTransport} from './Protocol.js'
import type {ReplicaSnapshotState} from './Types.js'
import {applyReplicaState, replicaRangeSource} from './InlineBundles.js'

export interface EntryReplicaClientOptions {
  config: Config
  transport: ReplicaTransport
  cache: IndexedDBReplicaCache
  fetch?: typeof globalThis.fetch
}

export interface EntryReplicaSyncResult {
  revision: string
  changed: boolean
  entryIds: ReadonlySet<string>
}

/** Owns authenticated state installation and the lazy client read model. */
export class EntryReplicaClient {
  #transport: ReplicaTransport
  #cache: IndexedDBReplicaCache
  #fetch: typeof globalThis.fetch
  #config: Config
  #bootstrap?: Promise<ReplicaBootstrap>
  #state?: ReplicaSnapshotState
  #snapshot?: RuntimeSnapshot
  #resolvers = new WeakMap<Config, DatabaseResolver>()

  constructor(options: EntryReplicaClientOptions) {
    this.#transport = options.transport
    this.#cache = options.cache
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#config = options.config
  }

  bootstrap(): Promise<ReplicaBootstrap> {
    this.#bootstrap ??= this.#transport.bootstrap()
    return this.#bootstrap
  }

  async sync(signal?: AbortSignal): Promise<EntryReplicaSyncResult> {
    const bootstrap = await this.bootstrap()
    const previous = this.#state
    const stored = previous ?? (await this.#cache.state(bootstrap.cacheKey))
    const cached = stored?.viewId === bootstrap.viewId ? stored : undefined
    const update = await this.#transport.state(
      cached
        ? {revision: cached.runtime.revision, viewId: cached.viewId}
        : undefined,
      signal
    )
    const state = update ? applyReplicaState(cached, update) : cached
    if (!state) throw new Error('Replica state is unavailable')
    if (state.viewId !== bootstrap.viewId)
      throw new Error('Replica state does not match the authenticated view')
    if (update) await this.#cache.installState(bootstrap.cacheKey, state)
    const changed = !previous || Boolean(update)
    const entryIds =
      update && 'delta' in update
        ? runtimeDeltaEntryIds(update.delta)
        : previous && update
          ? changedEntryIds(previous, state)
          : new Set<string>()
    if (changed) this.#install(state)
    return {revision: state.runtime.revision, changed, entryIds}
  }

  resolver(config: Config): DatabaseResolver {
    if (!this.#snapshot) throw new Error('Replica must be synchronized first')
    if (config === this.#config) return this.#snapshot.resolver
    const cached = this.#resolvers.get(config)
    if (cached) return cached
    const resolver = new DatabaseResolver(config, this.#snapshot.store)
    this.#resolvers.set(config, resolver)
    return resolver
  }

  get revision(): string | undefined {
    return this.#state?.runtime.revision
  }

  #install(state: ReplicaSnapshotState): void {
    this.#state = state
    const ranges = replicaRangeSource(
      state,
      url => new HttpRangeSource(url, this.#fetch)
    )
    this.#snapshot = this.#snapshot
      ? this.#snapshot.replace(state.runtime, ranges)
      : RuntimeSnapshot.open(this.#config, state.runtime, ranges)
    this.#resolvers = new WeakMap()
  }
}

function changedEntryIds(
  previous: ReplicaSnapshotState,
  next: ReplicaSnapshotState
): ReadonlySet<string> {
  const result = new Set<string>()
  const previousEntries = new Map(
    previous.runtime.entries.map(entry => [entry.id, entry])
  )
  const nextEntries = new Map(
    next.runtime.entries.map(entry => [entry.id, entry])
  )
  for (const recordId of new Set([
    ...previousEntries.keys(),
    ...nextEntries.keys()
  ])) {
    const before = previousEntries.get(recordId)
    const after = nextEntries.get(recordId)
    if (before && after && JSON.stringify(before) === JSON.stringify(after))
      continue
    if (before) result.add(before.entryId)
    if (after) result.add(after.entryId)
  }
  return result
}
