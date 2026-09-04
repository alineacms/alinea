import type {Config} from '#/core/Config.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {HttpRangeSource} from './HttpTransport.js'
import {IndexedDBReplicaCache} from './IndexedDBCache.js'
import type {ReplicaBootstrap, ReplicaTransport} from './Protocol.js'
import type {ReplicaState} from './Types.js'
import type {QueryDependency} from './Dependency.js'
import {replicaRangeSource} from './InlineBundles.js'

export interface EntryReplicaClientOptions {
  transport: ReplicaTransport
  cache: IndexedDBReplicaCache
  fetch?: typeof globalThis.fetch
}

export interface EntryReplicaSyncResult {
  revision: string
  changed: boolean
  change?: RuntimeReplicaChange
  entryIds: ReadonlySet<string>
}

export interface TrackedDatabaseResolver {
  resolver: DatabaseResolver
  dependencies(): ReadonlySet<QueryDependency>
}

export interface RuntimeReplicaChange {
  fromRevision: string
  toRevision: string
  records: ReadonlySet<string>
  dependencies: ReadonlySet<QueryDependency>
}

/** Owns authenticated state installation and the lazy client read model. */
export class EntryReplicaClient {
  #transport: ReplicaTransport
  #cache: IndexedDBReplicaCache
  #fetch: typeof globalThis.fetch
  #bootstrap?: Promise<ReplicaBootstrap>
  #state?: ReplicaState
  #source?: RuntimeEntryStore
  #cacheKey?: string
  #resolvers = new WeakMap<Config, DatabaseResolver>()

  constructor(options: EntryReplicaClientOptions) {
    this.#transport = options.transport
    this.#cache = options.cache
    this.#fetch = options.fetch ?? globalThis.fetch
  }

  bootstrap(): Promise<ReplicaBootstrap> {
    this.#bootstrap ??= this.#transport.bootstrap()
    return this.#bootstrap
  }

  async sync(signal?: AbortSignal): Promise<EntryReplicaSyncResult> {
    const bootstrap = await this.bootstrap()
    const previous = this.#state
    const cached = previous ?? (await this.#cache.state(bootstrap.cacheKey))
    const next = await this.#transport.state(cached?.runtime.revision, signal)
    const state = next ?? cached
    if (!state) throw new Error('Replica state is unavailable')
    if (next) await this.#cache.installState(bootstrap.cacheKey, next)
    const changed = !previous || Boolean(next)
    const change = previous && next ? runtimeChange(previous, next) : undefined
    const entryIds =
      change && previous
        ? changedEntryIds(previous, state, change.records)
        : new Set<string>()
    if (changed) this.#install(bootstrap.cacheKey, state)
    return {revision: state.runtime.revision, changed, change, entryIds}
  }

  resolver(config: Config): DatabaseResolver {
    if (!this.#source) throw new Error('Replica must be synchronized first')
    const cached = this.#resolvers.get(config)
    if (cached) return cached
    const resolver = new DatabaseResolver(config, this.#source)
    this.#resolvers.set(config, resolver)
    return resolver
  }

  trackedResolver(config: Config): TrackedDatabaseResolver {
    if (!this.#state) throw new Error('Replica must be synchronized first')
    if (!this.#cacheKey) throw new Error('Replica cache key is unavailable')
    return {
      resolver: new DatabaseResolver(config, this.#source!),
      dependencies: () => new Set(['revision:*'])
    }
  }

  access(recordId: string): 'explore' | 'read' | undefined {
    return this.#state?.recordAccess[recordId]
  }

  get revision(): string | undefined {
    return this.#state?.runtime.revision
  }

  #install(cacheKey: string, state: ReplicaState): void {
    this.#state = state
    this.#cacheKey = cacheKey
    this.#source = new RuntimeEntryStore({
      index: state.runtime,
      source: replicaRangeSource(
        state,
        url => new HttpRangeSource(url, this.#fetch)
      )
    })
    this.#resolvers = new WeakMap()
  }
}

function runtimeChange(
  previous: ReplicaState,
  next: ReplicaState
): RuntimeReplicaChange {
  const records = new Set([
    ...Object.keys(previous.recordEntries ?? {}),
    ...Object.keys(next.recordEntries ?? {})
  ])
  return {
    fromRevision: previous.runtime.revision,
    toRevision: next.runtime.revision,
    records,
    dependencies: new Set(['revision:*'])
  }
}

function changedEntryIds(
  previous: ReplicaState,
  next: ReplicaState,
  records: ReadonlySet<string>
): ReadonlySet<string> {
  const result = new Set<string>()
  for (const recordId of records) {
    for (const entryId of previous.recordEntries?.[recordId] ?? [])
      result.add(entryId)
    for (const entryId of next.recordEntries?.[recordId] ?? [])
      result.add(entryId)
  }
  return result
}
