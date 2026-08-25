import type {Config} from '#/core/Config.js'
import type {DatabaseReader} from '../Reader.js'
import {CachedDatabaseReader, ReplicaDatabaseReader} from '../Reader.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {BundleFrameLoader} from './Bundle.js'
import {diffCatalogs, type ReplicaChangeSet} from './Catalog.js'
import {HttpRangeSource} from './HttpTransport.js'
import {JsonReplicaCodec, LazyIndexReader} from './IndexReader.js'
import {IndexedDBReplicaCache} from './IndexedDBCache.js'
import type {ReplicaBootstrap, ReplicaTransport} from './Protocol.js'
import type {ReplicaState} from './Types.js'

export interface EntryReplicaClientOptions {
  transport: ReplicaTransport
  cache: IndexedDBReplicaCache<AlineaDatabaseRecord>
  fetch?: typeof globalThis.fetch
}

export interface EntryReplicaSyncResult {
  revision: string
  changed: boolean
  change?: ReplicaChangeSet
}

/** Owns authenticated state installation and the lazy client read model. */
export class EntryReplicaClient {
  #transport: ReplicaTransport
  #cache: IndexedDBReplicaCache<AlineaDatabaseRecord>
  #fetch: typeof globalThis.fetch
  #bootstrap?: Promise<ReplicaBootstrap>
  #state?: ReplicaState
  #reader?: DatabaseReader<AlineaDatabaseRecord>

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
    const cached = this.#state ?? (await this.#cache.state(bootstrap.cacheKey))
    const next = await this.#transport.state(cached?.catalog.revision, signal)
    const state = next ?? cached
    if (!state) throw new Error('Replica state is unavailable')
    if (next) await this.#cache.installState(bootstrap.cacheKey, next)
    const changed = !this.#state || Boolean(next)
    const change =
      this.#state && next
        ? diffCatalogs(this.#state.catalog, next.catalog)
        : undefined
    if (changed) this.#install(bootstrap.cacheKey, state)
    return {revision: state.catalog.revision, changed, change}
  }

  resolver(config: Config): DatabaseResolver {
    if (!this.#reader) throw new Error('Replica must be synchronized first')
    return new DatabaseResolver(config, this.#reader)
  }

  access(recordId: string): 'explore' | 'read' | undefined {
    return this.#state?.recordAccess[recordId]
  }

  #install(cacheKey: string, state: ReplicaState): void {
    const loader = new BundleFrameLoader(
      state.catalog.bundleId,
      new HttpRangeSource(state.catalog.bundleUrl, this.#fetch),
      state.grants,
      this.#cache
    )
    const lazy = new LazyIndexReader<AlineaDatabaseRecord, unknown>(
      state.catalog,
      loader,
      new JsonReplicaCodec()
    )
    this.#state = state
    this.#reader = new CachedDatabaseReader(
      new ReplicaDatabaseReader(lazy),
      this.#cache,
      `${cacheKey}\0${state.viewId}`
    )
  }
}
