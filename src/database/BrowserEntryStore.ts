import type {Config} from '#/core/Config.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import type {Database as WasmSqlite} from '@alinea/sqlite-wasm/Database.js'
import {
  baseOf,
  indexedDBSnapshotStorage,
  type SnapshotStorage
} from '@alinea/sqlite-wasm/snapshots'
import {sql} from 'rado'
import {databaseVersion, versionedCacheName} from './Version.js'
import {EntryDatabase} from './EntryDatabase.js'
import {EntryStore} from './EntryStore.js'
import {DatabaseSource} from './DatabaseSource.js'
import {wasmHandle, wasmSqlite} from './driver/WasmDatabase.js'

/**
 * Page cache in KiB. Pages of a base are read from IndexedDB as queries need
 * them, at 0.5 to 2 ms each: a scan that does not fit the cache reads every
 * page again each time.
 */
const cacheSize = -65536

/** Bases of this many configs are kept; the newest is always among them. */
const keepGroups = 2

export interface BrowserEntryStoreOptions {
  name: string
  /** Stores of one config fingerprint open the bases it wrote. */
  fingerprint: string
  /** Where bases are kept, Blobs in IndexedDB by default. */
  storage?: SnapshotStorage
}

/**
 * WASM entry store on a copy-on-write overlay over the newest stored base:
 * it reads pages from the base as queries need them, and keeps its changes
 * in memory. Every sync stores them as a new base in the background, which
 * the next store opens; the stored bases never change, so stores of any
 * number of workers and dashboard builds can use them at once.
 */
export class BrowserEntryStore extends EntryStore {
  #sqlite: WasmSqlite
  #storage: SnapshotStorage
  #fingerprint: string
  #stored: string | undefined
  #written: Promise<unknown> = Promise.resolve()

  static async open(
    config: Config,
    options: BrowserEntryStoreOptions
  ): Promise<BrowserEntryStore> {
    const {name, fingerprint} = options
    const storage =
      options.storage ??
      indexedDBSnapshotStorage(`${versionedCacheName(name)}-snapshots`)
    if (!options.storage && globalThis.indexedDB)
      await cleanupOldCaches(indexedDB, name)
    const Database = await wasmSqlite()
    const sqlite = await openBase(storage, Database, fingerprint)
    try {
      return await BrowserEntryStore.#on(config, sqlite, storage, fingerprint)
    } catch (error) {
      if (!baseOf(sqlite)) throw error
      // Start over from an empty database rather than one this build cannot
      // read or derive again.
      return BrowserEntryStore.#on(config, new Database(), storage, fingerprint)
    }
  }

  static async #on(
    config: Config,
    sqlite: WasmSqlite,
    storage: SnapshotStorage,
    fingerprint: string
  ): Promise<BrowserEntryStore> {
    const group = baseOf(sqlite)?.group
    sqlite.run(`pragma cache_size = ${cacheSize}`)
    const {database: db, fork} = wasmHandle(sqlite)
    try {
      // Larger pages read a base in fewer, larger reads. Only applies to a
      // new database.
      await db.run(sql`pragma page_size = 65536`)
      await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
      const database = new EntryDatabase(config, db, {fork})
      // Content stored for another config is derived again for this one,
      // instead of syncing every entry from the remote into an empty
      // database.
      if (group !== undefined && group !== fingerprint)
        await database.reindex(config)
      return new BrowserEntryStore(
        config,
        database,
        sqlite,
        storage,
        fingerprint
      )
    } catch (error) {
      await db.close()
      throw error
    }
  }

  private constructor(
    config: Config,
    database: EntryDatabase,
    sqlite: WasmSqlite,
    storage: SnapshotStorage,
    fingerprint: string
  ) {
    super(config, database, new DatabaseSource(database), {
      ownsDatabase: true,
      sourceFollowsDatabase: true
    })
    this.#sqlite = sqlite
    this.#storage = storage
    this.#fingerprint = fingerprint
  }

  override async sync(): Promise<string> {
    return this.#checkpoint(await super.sync())
  }

  override async syncWith(
    remote: RemoteSource,
    options?: SyncOptions
  ): Promise<string> {
    return this.#checkpoint(await super.syncWith(remote, options))
  }

  /** Store the content at `revision` as a base, in the background. */
  #checkpoint(revision: string): string {
    if (!this.#storage.supported() || this.#stored === revision) return revision
    this.#stored = revision
    const storage = this.#storage
    const group = this.#fingerprint
    // Checkpoints fork the database, which fails during a transaction. The
    // write itself is not awaited: the database keeps working meanwhile.
    this.#written = this.database
      .whileIdle(async () => ({
        written: storage.checkpoint(this.#sqlite, `${revision}-${group}`, {
          group,
          meta: {tree: revision}
        })
      }))
      .then(({written}) => written)
      .then(() => storage.cleanup({keepGroups}))
      .catch(() => {
        if (this.#stored === revision) this.#stored = undefined
      })
    return revision
  }

  /** Close once the last checkpoint is stored. */
  override async close(): Promise<void> {
    await this.#written
    await super.close()
  }
}

/**
 * Open the newest base of `fingerprint`, or else the newest of any config,
 * or an empty database.
 */
async function openBase(
  storage: SnapshotStorage,
  Database: new () => WasmSqlite,
  fingerprint: string
): Promise<WasmSqlite> {
  if (!storage.supported()) return new Database()
  // A base that cannot be read is replaced by the next checkpoint.
  return storage
    .open(Database, {group: fingerprint, fallback: 'any'})
    .catch(() => new Database())
}

/**
 * Delete the IndexedDB databases of older Alinea versions and layouts. Those
 * of newer versions belong to builds that may still run.
 */
async function cleanupOldCaches(
  factory: IDBFactory,
  name: string
): Promise<void> {
  if (!factory.databases) return
  const databases = await factory.databases().catch(() => [])
  const stale = databases.flatMap(database =>
    database.name && isStale(database.name, name) ? [database.name] : []
  )
  await Promise.all(stale.map(cache => deleteCache(factory, cache)))
}

function isStale(cache: string, name: string): boolean {
  if (cache === name || cache === `${versionedCacheName(name)}-pages`)
    return true
  if (!cache.startsWith(`${name}-v`)) return false
  return Number.parseInt(cache.slice(name.length + 2)) < databaseVersion
}

function deleteCache(factory: IDBFactory, name: string): Promise<void> {
  return new Promise(resolve => {
    const request = factory.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}
