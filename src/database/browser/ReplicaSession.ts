import type {Config} from '#/core/Config.js'
import {Graph, type GraphQuery, type AnyQueryResult} from '#/core/Graph.js'
import type {Database} from 'rado'
import {entryVersionId} from '../entry/Schema.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import {decodeBootstrap, type ExpectedReplica} from './DecodeBootstrap.js'
import {
  HttpPayloadLoader,
  type HttpPayloadLoaderOptions
} from './HttpPayloadLoader.js'
import {ReplicaCache, type ReplicaIdentity} from './ReplicaCache.js'
import {fetchBootstrap, type FetchBootstrapOptions} from './FetchBootstrap.js'

export interface ReplicaSessionOptions extends Omit<
  HttpPayloadLoaderOptions,
  'identity' | 'revision' | 'cache' | 'onInvalidated'
> {
  config: Config
  bootstrap: unknown
  expected: ExpectedReplica
  indexedDB?: IDBFactory
  /** Cancels startup only; close() controls the lifetime of a ready session. */
  signal?: AbortSignal
  onInvalidated?(error: Error): void
}

export interface ConnectReplicaOptions
  extends Omit<ReplicaSessionOptions, 'bootstrap'>, FetchBootstrapOptions {}

/** One authenticated in-memory Graph generation; never opens SQL from cached bytes. */
export class ReplicaSession extends Graph {
  readonly config: Config
  #view: IndexBootstrap
  #db: Database
  #runtime: EntryRuntime
  #loader: HttpPayloadLoader
  #cache?: ReplicaCache
  #pending = new Set<Promise<unknown>>()
  #closed = false
  #closing?: Promise<void>
  #purging?: Promise<void>
  #indexedDB?: IDBFactory

  private constructor(
    options: ReplicaSessionOptions,
    view: IndexBootstrap,
    db: Database,
    cache?: ReplicaCache
  ) {
    super()
    this.config = options.config
    this.#view = view
    this.#db = db
    this.#cache = cache
    this.#indexedDB = options.indexedDB
    this.#loader = new HttpPayloadLoader({
      ...options,
      identity: view.identity,
      revision: view.revision,
      cache,
      onInvalidated: error => {
        // Gate new reads synchronously; cleanup drains already-running queries.
        // A stale revision may already have a newer session sharing this cache.
        // Do not erase its index/ciphertext; definitive denial/logout still purge.
        void this.close(error.code !== 409).catch(() => {})
        options.onInvalidated?.(error)
      }
    })
    this.#runtime = new EntryRuntime(options.config, db, {
      load: requests => this.#loader.load(requests)
    })
  }

  static async open(options: ReplicaSessionOptions): Promise<ReplicaSession> {
    const {signal} = options
    signal?.throwIfAborted()
    const view = decodeBootstrap(options.bootstrap, options.expected)
    const db = await wasmDatabase()
    let cache: ReplicaCache | undefined
    let session: ReplicaSession | undefined
    try {
      signal?.throwIfAborted()
      if (options.indexedDB) {
        cache = await ReplicaCache.open(options.indexedDB, view.identity)
        signal?.throwIfAborted()
        const previous = await cache.snapshot()
        if (previous.revision !== view.revision) {
          const present = new Set(
            view.entries.map(({entry}) =>
              entryVersionId(entry.id, entry.locale, entry.versionStatus)
            )
          )
          await cache.apply({
            fromRevision: previous.revision,
            toRevision: view.revision,
            entries: view.entries,
            removedVersionIds: previous.entries
              .map(({entry}) =>
                entryVersionId(entry.id, entry.locale, entry.versionStatus)
              )
              .filter(id => !present.has(id))
          })
        }
      }
      signal?.throwIfAborted()
      await EntryRuntime.createSchema(db, '')
      session = new ReplicaSession(options, view, db, cache)
      await session.#runtime.apply({
        fromRevision: '',
        toRevision: view.revision,
        entries: view.entries
      })
      signal?.throwIfAborted()
      return session
    } catch (error) {
      if (session) await session.close()
      else {
        cache?.close()
        await db.close()
      }
      throw error
    }
  }

  static async connect(
    options: ConnectReplicaOptions
  ): Promise<ReplicaSession> {
    const captured = {...options, expected: {...options.expected}}
    const bootstrap = await fetchBootstrap(captured)
    return ReplicaSession.open({...captured, bootstrap})
  }

  get bootstrap(): IndexBootstrap {
    if (this.#closed) throw new Error('Replica session closed')
    return structuredClone(this.#view)
  }

  get identity(): ReplicaIdentity {
    if (this.#closed) throw new Error('Replica session closed')
    return {...this.#view.identity}
  }

  get revision(): string {
    if (this.#closed) throw new Error('Replica session closed')
    return this.#view.revision
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (this.#closed) return Promise.reject(new Error('Replica session closed'))
    const pending = this.#runtime.resolve(query).then(value => {
      if (this.#closed) throw new Error('Replica session closed')
      return value
    })
    this.#pending.add(pending)
    return pending.finally(() => this.#pending.delete(pending))
  }

  /** Logout/revocation purges this identity's disk cache; ordinary close retains ciphertext. */
  close(purge = false): Promise<void> {
    if (!this.#closing) {
      this.#closed = true
      this.#loader.close()
      this.#closing = (async () => {
        await Promise.allSettled([...this.#pending])
        try {
          await this.#db.close()
        } finally {
          this.#cache?.close()
        }
      })()
    }
    if (purge && !this.#purging) {
      this.#purging = this.#closing.then(async () => {
        if (this.#indexedDB) {
          const cache = await ReplicaCache.open(
            this.#indexedDB,
            this.#view.identity
          )
          await cache.purge()
        }
      })
    }
    return this.#purging ?? this.#closing
  }
}
