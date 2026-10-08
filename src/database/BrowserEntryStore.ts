import type {Config} from '#/core/Config.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {TaskQueue} from '#/core/util/Async.js'
import {isRecord} from '#/core/util/Objects.js'
import {
  indexedDBStorage,
  type IndexedDBStorage
} from '@alinea/sqlite-wasm/indexeddb'
import {sql, type Database} from 'rado'
import {versionedCacheName} from './Version.js'
import {EntryDatabase} from './EntryDatabase.js'
import {EntryStore} from './EntryStore.js'
import {DatabaseSource} from './DatabaseSource.js'
import {
  syncWasmDatabase,
  type WasmDatabaseHandle
} from './driver/WasmDatabase.js'

/** The dashboard build that last derived the stored entries. */
const buildTable = sql.identifier('alinea_dashboard_build')

export interface BrowserEntryStoreOptions {
  name: string
  revision: string
  /**
   * Start over from an empty database instead of the stored one, such as
   * when it turned out to be corrupt.
   */
  reset?: boolean
  /** The IndexedDB implementation, the global one by default. */
  indexedDB?: IDBFactory
  IDBKeyRange?: typeof IDBKeyRange
  /** The Web Locks implementation, the global one by default. */
  locks?: CacheLocks
}

/** The part of the Web Locks API that keeps a cache to one worker. */
export interface CacheLocks {
  request(
    name: string,
    options: {ifAvailable?: boolean; signal?: AbortSignal},
    callback: (lock: Lock | null) => Promise<void> | void
  ): Promise<unknown>
}

export interface HoldCacheOptions {
  /**
   * How long to wait, in milliseconds, for another worker that holds the
   * cache to end: none by default, Infinity until it does.
   */
  wait?: number
  /** The Web Locks implementation, the global one by default. */
  locks?: CacheLocks
}

/**
 * Hold the cache called `name` for as long as this worker runs, and resolve
 * with whether it does. Nothing coordinates two stores writing the same
 * pages, which corrupts them, so only the worker that holds the cache opens
 * it; another one, such as one of another dashboard build, reads a
 * snapshot. Without Web Locks, or if they refuse, no worker holds it.
 */
export function holdCache(
  name: string,
  options: HoldCacheOptions = {}
): Promise<boolean> {
  const locks = options.locks ?? globalThis.navigator?.locks
  if (!locks) return Promise.resolve(false)
  const {wait = 0} = options
  const timeout =
    wait > 0 && wait < Infinity ? new AbortController() : undefined
  const timer = timeout && setTimeout(() => timeout.abort(), wait)
  const request =
    wait === 0 ? {ifAvailable: true} : timeout ? {signal: timeout.signal} : {}
  return new Promise(resolve => {
    try {
      locks
        .request(storageNameOf(name), request, lock => {
          clearTimeout(timer)
          resolve(Boolean(lock))
          // Released when the worker ends.
          if (lock) return new Promise<void>(() => {})
        })
        .catch(() => resolve(false))
    } catch {
      resolve(false)
    }
  })
}

/**
 * WASM entry store kept in IndexedDB: every commit stores the pages it
 * changed.
 */
export class BrowserEntryStore extends EntryStore {
  #handle: WasmDatabaseHandle
  #persistQueue = new TaskQueue()
  #closed = false
  #detached = false

  /**
   * Open the store kept in IndexedDB. Only the worker that holds the cache
   * opens it (see `holdCache`), and deletes the caches of other versions.
   */
  static async open(
    config: Config,
    options: BrowserEntryStoreOptions
  ): Promise<BrowserEntryStore> {
    const storageName = storageNameOf(options.name)
    const factory = options.indexedDB ?? indexedDB
    const storage = indexedDBStorage(storageName, {
      indexedDB: factory,
      IDBKeyRange: options.IDBKeyRange ?? IDBKeyRange
    })
    const openStorage = () =>
      BrowserEntryStore.#openStorage(config, options, storage)
    if (options.reset) await storage.delete()
    let store: BrowserEntryStore
    try {
      store = await openStorage()
    } catch {
      // Start over from an empty database rather than keep one this build
      // cannot read, such as a stored one that is corrupt (SQLITE_CORRUPT).
      await storage.delete()
      store = await openStorage()
    }
    await cleanupOldCaches({
      factory,
      locks: options.locks ?? globalThis.navigator?.locks,
      baseName: options.name,
      currentName: storageName
    })
    return store
  }

  /**
   * A copy in memory of the stored content, for a worker that cannot store
   * it while another one does: it loads the last committed state and never
   * writes. Resolves with undefined if that state cannot be read.
   */
  static async snapshot(
    config: Config,
    options: BrowserEntryStoreOptions
  ): Promise<EntryStore | undefined> {
    const storage = indexedDBStorage(storageNameOf(options.name), {
      indexedDB: options.indexedDB ?? indexedDB,
      IDBKeyRange: options.IDBKeyRange ?? IDBKeyRange
    })
    let handle: WasmDatabaseHandle | undefined
    try {
      handle = await syncWasmDatabase(storage)
      // Before any statement: nothing it changes is stored.
      handle.detach()
      const db = handle.database
      const stored = await storedBuild(db)
      if (stored === undefined) {
        await db.close()
        return undefined
      }
      await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
      const database = new EntryDatabase(config, db, {fork: handle.fork})
      if (stored !== options.revision) await database.reindex(config)
      return new EntryStore(config, database, new DatabaseSource(database), {
        ownsDatabase: true,
        sourceFollowsDatabase: true
      })
    } catch (error) {
      if (handle) await handle.database.close()
      console.warn('Failed to read the content cache', error)
      return undefined
    }
  }

  static async #openStorage(
    config: Config,
    options: BrowserEntryStoreOptions,
    storage: IndexedDBStorage
  ): Promise<BrowserEntryStore> {
    const handle = await syncWasmDatabase(storage)
    try {
      const db = handle.database
      // IndexedDB stores one record per page: larger pages store and load a
      // large database several times faster. Only applies to a new database.
      await db.run(sql`pragma page_size = 65536`)
      const stored = await storedBuild(db)
      await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
      const database = new EntryDatabase(config, db, {fork: handle.fork})
      // Content stored by another dashboard build is derived again with this
      // build's config, instead of syncing every entry from the remote into
      // an empty database.
      if (stored !== undefined && stored !== options.revision)
        await database.reindex(config)
      if (stored !== options.revision)
        await db.run(
          sql`insert or replace into ${buildTable} (id, revision)
            values (1, ${options.revision})`
        )
      return new BrowserEntryStore(config, database, handle)
    } catch (error) {
      await handle.database.close()
      throw error
    }
  }

  #detach(): void {
    if (this.#detached) return
    this.#detached = true
    this.#handle.detach()
  }

  private constructor(
    config: Config,
    database: EntryDatabase,
    handle: WasmDatabaseHandle
  ) {
    super(config, database, new DatabaseSource(database), {
      ownsDatabase: true,
      sourceFollowsDatabase: true
    })
    this.#handle = handle
  }

  /**
   * Opening, and syncing, resolve once the content is in memory: storing it
   * is a cache that finishes in the background, which takes seconds for a
   * first sync or a rebuild of a large project.
   */
  override sync(): Promise<string> {
    return this.#run(() => super.sync())
  }

  override syncWith(
    remote: RemoteSource,
    options?: SyncOptions
  ): Promise<string> {
    return this.#run(() => super.syncWith(remote, options))
  }

  override mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.#persistAfter(() => super.mutate(mutations))
  }

  override write(request: CommitRequest): Promise<{sha: string}> {
    return this.#persistAfter(() => super.write(request))
  }

  /** Resolve once the commits of a task that changed this store are stored. */
  #persistAfter<T>(task: () => Promise<T>): Promise<T> {
    return this.#run(async () => {
      const result = await task()
      await this.#store()
      return result
    })
  }

  /**
   * Wait for the commits so far to be stored. The cache only saves loading
   * time: if storing fails, such as over quota, it stops instead of failing
   * the commit, and keeps the last committed state it stored.
   */
  async #store(): Promise<void> {
    if (this.#detached) return
    try {
      await this.#handle.flush()
    } catch (error) {
      console.warn('Stopped caching content in IndexedDB', error)
      this.#detach()
    }
  }

  /**
   * Stop storing, and resolve once the commits so far are stored, for a
   * replacement to open the cache. Work in flight then changes only this
   * store's memory, so the replacement need not wait for it.
   */
  async release(): Promise<void> {
    this.#detach()
    await this.#handle.flush().catch(() => {})
  }

  #run<T>(task: () => Promise<T>): Promise<T> {
    if (this.#closed)
      return Promise.reject(new Error('BrowserEntryStore is closed'))
    return this.#persistQueue.run(task)
  }

  override close(): Promise<void> {
    if (this.#closed) return this.#persistQueue.drain()
    this.#closed = true
    return this.#persistQueue.run(() => super.close())
  }
}

const corruptCodes = new Set(['SQLITE_CORRUPT', 'SQLITE_NOTADB'])
const corruptMessage = /database disk image is malformed|file is not a database/

/** Whether an error, or one it holds, reports a damaged SQLite database. */
export function isCorruptDatabaseError(error: unknown): boolean {
  if (!isRecord(error)) return false
  if (typeof error.code === 'string' && corruptCodes.has(error.code))
    return true
  if (typeof error.message === 'string' && corruptMessage.test(error.message))
    return true
  const errors = Array.isArray(error.errors) ? error.errors : []
  return (
    isCorruptDatabaseError(error.cause) || errors.some(isCorruptDatabaseError)
  )
}

function storageNameOf(name: string): string {
  return `${versionedCacheName(name)}-pages`
}

async function storedBuild(db: Database): Promise<string | undefined> {
  await db.run(sql`create table if not exists ${buildTable} (
    id integer primary key,
    revision text not null
  )`)
  const row = await db.get<{revision: string}>(
    sql`select revision from ${buildTable} where id = 1`
  )
  if (row) return row.revision
  // Entries without a recorded build were stored by an interrupted open.
  const entries = await db.get<{count: number}>(
    sql`select count(*) as count from sqlite_master
      where type = 'table' and name = 'alinea_entry_index'`
  )
  return entries?.count ? '' : undefined
}

/** Delete the IndexedDB databases of other Alinea versions and layouts. */
interface CleanupOptions {
  factory: IDBFactory
  locks: CacheLocks | undefined
  baseName: string
  currentName: string
}

async function cleanupOldCaches({
  factory,
  locks,
  baseName,
  currentName
}: CleanupOptions): Promise<void> {
  if (!factory.databases) return
  const databases = await factory.databases().catch(() => [])
  const names = databases.flatMap(database =>
    database.name &&
    database.name !== currentName &&
    (database.name === baseName || database.name.startsWith(`${baseName}-`))
      ? [database.name]
      : []
  )
  await Promise.all(names.map(name => deleteUnheldCache(factory, locks, name)))
}

/**
 * Delete a cache unless a worker holds it, such as one of another version
 * still open in a tab: caches are held under their own name.
 */
async function deleteUnheldCache(
  factory: IDBFactory,
  locks: CacheLocks | undefined,
  name: string
): Promise<void> {
  if (!locks) return deleteCache(factory, name)
  await locks
    .request(name, {ifAvailable: true}, lock => {
      if (lock) return deleteCache(factory, name)
    })
    .catch(() => {})
}

function deleteCache(factory: IDBFactory, name: string): Promise<void> {
  return new Promise(resolve => {
    const request = factory.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}
