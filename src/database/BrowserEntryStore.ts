import type {Config} from '#/core/Config.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {TaskQueue} from '#/core/util/Async.js'
import type {Storage} from '@alinea/sqlite-wasm/Database.js'
import {indexedDBStorage} from '@alinea/sqlite-wasm/indexeddb'
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
   * The store this one replaces, such as one of a previous dashboard build:
   * its content carries over from memory instead of loading it again, and it
   * stops storing without waiting for its work in flight.
   */
  replaces?: BrowserEntryStore
  /** The IndexedDB implementation, the global one by default. */
  indexedDB?: IDBFactory
  IDBKeyRange?: typeof IDBKeyRange
}

/**
 * WASM entry store kept in IndexedDB: every commit stores the pages it
 * changed.
 */
export class BrowserEntryStore extends EntryStore {
  #handle: WasmDatabaseHandle
  #indexedDB: IDBFactory
  #baseName: string
  #storageName: string
  #persistQueue = new TaskQueue()
  #closed = false
  #detached = false

  static async open(
    config: Config,
    options: BrowserEntryStoreOptions,
    retried = false
  ): Promise<BrowserEntryStore> {
    const factory = options.indexedDB ?? indexedDB
    const storageName = storageNameOf(options.name)
    const storage = indexedDBStorage(storageName, {
      indexedDB: factory,
      IDBKeyRange: options.IDBKeyRange ?? IDBKeyRange
    })
    let handle: WasmDatabaseHandle | undefined
    try {
      handle = options.replaces
        ? await options.replaces.#handOver(storage)
        : await syncWasmDatabase(storage)
      const db = handle.database
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
      await handle.flush()
      return new BrowserEntryStore(
        config,
        database,
        handle,
        factory,
        options.name,
        storageName
      )
    } catch (error) {
      if (handle) await handle.database.close()
      if (retried) throw error
      // Start over from an empty database rather than keep one this build
      // cannot read, such as a stored one that is corrupt (SQLITE_CORRUPT).
      await storage.delete()
      return BrowserEntryStore.open(
        config,
        {...options, replaces: undefined},
        true
      )
    }
  }

  /**
   * Copy this store's database for a replacement stored in `storage`, and
   * stop storing this one. The replacement is stored once this store's
   * commits so far are written.
   */
  async #handOver(storage: Storage): Promise<WasmDatabaseHandle> {
    const copy = await this.database.whileIdle(() => this.#handle.fork())
    this.#detach()
    try {
      await copy.attach(storage)
      return copy
    } catch (error) {
      await copy.database.close()
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
    handle: WasmDatabaseHandle,
    factory: IDBFactory,
    baseName: string,
    storageName: string
  ) {
    super(config, database, new DatabaseSource(database), {
      ownsDatabase: true,
      sourceFollowsDatabase: true
    })
    this.#handle = handle
    this.#indexedDB = factory
    this.#baseName = baseName
    this.#storageName = storageName
  }

  override sync(): Promise<string> {
    return this.#persistAfter(() => super.sync())
  }

  override syncWith(
    remote: RemoteSource,
    options?: SyncOptions
  ): Promise<string> {
    return this.#persistAfter(() => super.syncWith(remote, options))
  }

  override mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.#persistAfter(() => super.mutate(mutations))
  }

  override write(request: CommitRequest): Promise<{sha: string}> {
    return this.#persistAfter(() => super.write(request))
  }

  /** Resolve once the commits of a task that changed this store are stored. */
  #persistAfter<T>(task: () => Promise<T>): Promise<T> {
    if (this.#closed)
      return Promise.reject(new Error('BrowserEntryStore is closed'))
    return this.#persistQueue.run(async () => {
      const result = await task()
      await this.#handle.flush()
      return result
    })
  }

  override close(): Promise<void> {
    if (this.#closed) return this.#persistQueue.drain()
    this.#closed = true
    return this.#persistQueue.run(async () => {
      try {
        await super.close()
      } finally {
        await cleanupOldCaches(
          this.#indexedDB,
          this.#baseName,
          this.#storageName
        )
      }
    })
  }

  /**
   * Close a store that a replacement took over from: its work in flight
   * changes only its memory copy, which is not stored.
   */
  abandon(): Promise<void> {
    this.#detach()
    if (this.#closed) return this.#persistQueue.drain()
    this.#closed = true
    return this.#persistQueue.run(() => super.close())
  }
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
async function cleanupOldCaches(
  factory: IDBFactory,
  baseName: string,
  currentName: string
): Promise<void> {
  if (!factory.databases) return
  const databases = await factory.databases().catch(() => [])
  const names = databases.flatMap(database =>
    database.name &&
    database.name !== currentName &&
    (database.name === baseName || database.name.startsWith(`${baseName}-`))
      ? [database.name]
      : []
  )
  await Promise.all(names.map(name => deleteCache(factory, name)))
}

function deleteCache(factory: IDBFactory, name: string): Promise<void> {
  return new Promise(resolve => {
    const request = factory.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}
