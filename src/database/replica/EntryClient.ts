import type {Config} from '#/core/Config.js'
import type {DatabaseReader} from '../Reader.js'
import {
  CachedDatabaseReader,
  ReplicaDatabaseReader,
  TrackedDatabaseReader
} from '../Reader.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'
import type {EntryStore} from '../entry/Store.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {CatalogFrameLoader} from './Bundle.js'
import {diffCatalogs, type ReplicaChangeSet} from './Catalog.js'
import {HttpRangeSource} from './HttpTransport.js'
import {JsonReplicaCodec, LazyIndexReader} from './IndexReader.js'
import {IndexedDBReplicaCache} from './IndexedDBCache.js'
import type {ReplicaBootstrap, ReplicaTransport} from './Protocol.js'
import type {ReplicaState} from './Types.js'
import type {QueryDependency} from './Dependency.js'
import {replicaRangeSource} from './InlineBundles.js'

export interface EntryReplicaClientOptions {
  transport: ReplicaTransport
  cache: IndexedDBReplicaCache<AlineaDatabaseRecord>
  fetch?: typeof globalThis.fetch
}

export interface EntryReplicaSyncResult {
  revision: string
  changed: boolean
  change?: ReplicaChangeSet
  entryIds: ReadonlySet<string>
}

export interface TrackedDatabaseResolver {
  resolver: DatabaseResolver
  dependencies(): ReadonlySet<QueryDependency>
}

/** Owns authenticated state installation and the lazy client read model. */
export class EntryReplicaClient {
  #transport: ReplicaTransport
  #cache: IndexedDBReplicaCache<AlineaDatabaseRecord>
  #fetch: typeof globalThis.fetch
  #bootstrap?: Promise<ReplicaBootstrap>
  #state?: ReplicaState
  #source?: DatabaseReader<AlineaDatabaseRecord> | EntryStore
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
    const next = await this.#transport.state(cached?.catalog.revision, signal)
    const state = next ?? cached
    if (!state) throw new Error('Replica state is unavailable')
    if (next) await this.#cache.installState(bootstrap.cacheKey, next)
    const changed = !previous || Boolean(next)
    const change =
      previous && next
        ? previous.runtime && next.runtime
          ? runtimeChange(previous, next)
          : diffCatalogs(previous.catalog, next.catalog)
        : undefined
    const entryIds =
      change && previous
        ? changedEntryIds(previous, state, change.records)
        : new Set<string>()
    if (changed) this.#install(bootstrap.cacheKey, state)
    return {revision: state.catalog.revision, changed, change, entryIds}
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
    if (this.#state.runtime)
      return {
        resolver: new DatabaseResolver(config, this.#source!),
        dependencies: () => new Set(['revision:*'])
      }
    const tracked = new TrackedDatabaseReader(
      this.#readerForState(this.#state, this.#cacheKey).reader
    )
    return {
      resolver: new DatabaseResolver(config, tracked),
      dependencies: () => tracked.dependencies()
    }
  }

  access(recordId: string): 'explore' | 'read' | undefined {
    return this.#state?.recordAccess[recordId]
  }

  get revision(): string | undefined {
    return this.#state?.catalog.revision
  }

  #install(cacheKey: string, state: ReplicaState): void {
    this.#state = state
    this.#cacheKey = cacheKey
    this.#source = state.runtime
      ? new RuntimeEntryStore({
          index: state.runtime,
          source: replicaRangeSource(
            state,
            url => new HttpRangeSource(url, this.#fetch)
          )
        })
      : this.#readerForState(state, cacheKey).reader
    this.#resolvers = new WeakMap()
  }

  #readerForState(
    state: ReplicaState,
    cacheKey: string
  ): {
    reader: DatabaseReader<AlineaDatabaseRecord>
  } {
    const loader = new CatalogFrameLoader(
      state.catalog.bundleId,
      state.catalog.bundleUrl,
      url => new HttpRangeSource(url, this.#fetch),
      state.grants,
      this.#cache
    )
    const lazy = new LazyIndexReader<AlineaDatabaseRecord, unknown>(
      state.catalog,
      loader,
      new JsonReplicaCodec()
    )
    const reader = new CachedDatabaseReader(
      new ReplicaDatabaseReader(lazy),
      this.#cache,
      `${cacheKey}\0${state.viewId}`
    )
    return {reader}
  }
}

function runtimeChange(
  previous: ReplicaState,
  next: ReplicaState
): ReplicaChangeSet {
  const records = new Set([
    ...Object.keys(previous.recordEntries ?? {}),
    ...Object.keys(next.recordEntries ?? {})
  ])
  return {
    fromRevision: previous.catalog.revision,
    toRevision: next.catalog.revision,
    records,
    indexes: new Set(),
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
