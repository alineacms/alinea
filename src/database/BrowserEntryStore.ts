import type {Config} from '#/core/Config.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {isRecord} from '#/core/util/Objects.js'
import type {Database as WasmSqlite} from '@alinea/sqlite-wasm/Database.js'
import {
  indexedDBSnapshots,
  type Session,
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
const keepBranches = 2

export interface BrowserEntryStoreOptions {
  name: string
  /** Stores of one config fingerprint open the bases it wrote. */
  fingerprint: string
  /** Where bases are kept, Blobs in IndexedDB by default. */
  storage?: SnapshotStorage
  /**
   * Start over from an empty database instead of a stored base, such as
   * when it turned out to be corrupt.
   */
  reset?: boolean
}

/**
 * WASM entry store on a copy-on-write overlay over the newest stored base:
 * it reads pages from the base as queries need them, and keeps its changes
 * in memory. Every sync stores them as a new base in the background, which
 * the next store opens; the stored bases never change, so stores of any
 * number of workers and dashboard builds can use them at once.
 */
export class BrowserEntryStore extends EntryStore {
  #session: Session<WasmSqlite>
  #storage: SnapshotStorage
  #stored: string | undefined
  #written: Promise<unknown> = Promise.resolve()
  #cleanup: Promise<void> = Promise.resolve()

  static async open(
    config: Config,
    options: BrowserEntryStoreOptions
  ): Promise<BrowserEntryStore> {
    const {name, fingerprint} = options
    const storage =
      options.storage ??
      indexedDBSnapshots(`${versionedCacheName(name)}-snapshots`)
    // Other caches are deleted in the background, they don't affect this one.
    const cleanup =
      !options.storage && globalThis.indexedDB
        ? cleanupOldCaches(indexedDB, name).catch(() => {})
        : Promise.resolve()
    const Database = await wasmSqlite()
    const session = options.reset
      ? storage.session(new Database(), {branch: fingerprint})
      : await openBase(storage, Database, fingerprint)
    const store = await BrowserEntryStore.#on(
      config,
      session,
      storage,
      fingerprint
    ).catch(error => {
      if (!session.snapshot) throw error
      // Start over from an empty database rather than one this build cannot
      // read or derive again.
      return BrowserEntryStore.#on(
        config,
        storage.session(new Database(), {branch: fingerprint}),
        storage,
        fingerprint
      )
    })
    store.#cleanup = cleanup
    return store
  }

  static async #on(
    config: Config,
    session: Session<WasmSqlite>,
    storage: SnapshotStorage,
    fingerprint: string
  ): Promise<BrowserEntryStore> {
    const sqlite = session.db
    const branch = session.snapshot?.branch
    sqlite.run(`pragma cache_size = ${cacheSize}`)
    const {database: db, fork} = wasmHandle(sqlite)
    // Previews fork the store to read a few entries: the default cache of a
    // database on a base will do, rather than another copy of the store's.
    async function preview() {
      const copy = await fork()
      await copy.database.run(sql`pragma cache_size = -8192`)
      return copy
    }
    try {
      // Bases are read a block at a time while reads run forward, so pages
      // need not be large; smaller ones keep less in memory per change and
      // save smaller deltas. Only applies to a new database.
      await db.run(sql`pragma page_size = 16384`)
      await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
      const database = new EntryDatabase(config, db, {fork: preview})
      // Content stored for another config is derived again for this one,
      // instead of syncing every entry from the remote into an empty
      // database.
      if (branch !== undefined && branch !== fingerprint)
        await withoutJournal(sqlite, () => database.reindex(config))
      return new BrowserEntryStore(config, database, session, storage)
    } catch (error) {
      await db.close()
      throw error
    }
  }

  private constructor(
    config: Config,
    database: EntryDatabase,
    session: Session<WasmSqlite>,
    storage: SnapshotStorage
  ) {
    super(config, database, new DatabaseSource(database), {
      ownsDatabase: true,
      sourceFollowsDatabase: true
    })
    this.#session = session
    this.#storage = storage
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
    const session = this.#session
    const storage = this.#storage
    const key = `${revision}-${session.branch}`
    // Saves fork the database, which fails during a transaction. The write
    // itself is not awaited: the database keeps working meanwhile. A
    // database that holds no changed pages reads a base with its content
    // already, as after opening a base another worker stored.
    const save = (key: string) =>
      this.database
        .whileIdle(async () => ({
          saved: session.held
            ? session.save({key, meta: {tree: revision}})
            : undefined
        }))
        .then(({saved}) => saved)
    // Another worker may have stored this content in other pages, which
    // the database cannot move onto: it would keep every page it changed in
    // memory, so it stores a base of its own (a delta), which retain keeps
    // instead.
    const written = save(key)
      .then(result =>
        result?.status === 'mismatch'
          ? save(`${key}-${crypto.randomUUID()}`)
          : result
      )
      .then(() => storage.retain({branches: keepBranches}))
      .catch(() => {
        if (this.#stored === revision) this.#stored = undefined
      })
    // A mismatch saves once more after the first save: close waits for
    // every save that is still writing.
    this.#written = Promise.all([this.#written, written])
    return revision
  }

  /** Close once the last checkpoint is stored. */
  override async close(): Promise<void> {
    await Promise.all([this.#cleanup, this.#written])
    await super.close()
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

/**
 * Run `task` without a rollback journal. A reindex changes every page, and
 * the journal would hold the original of each in memory: a second copy of
 * the database. A failed task leaves the database unusable, which the store
 * then replaces with an empty one.
 */
async function withoutJournal<T>(
  sqlite: WasmSqlite,
  task: () => Promise<T>
): Promise<T> {
  const [[mode]] = sqlite.exec('pragma journal_mode')[0].values
  sqlite.run('pragma journal_mode = off')
  try {
    return await task()
  } finally {
    sqlite.run(`pragma journal_mode = ${mode}`)
  }
}

/**
 * Open the newest base of `fingerprint`, or else the newest of any config,
 * or an empty database; it saves to `fingerprint` either way.
 */
async function openBase(
  storage: SnapshotStorage,
  Database: new () => WasmSqlite,
  fingerprint: string
): Promise<Session<WasmSqlite>> {
  const empty = () => storage.session(new Database(), {branch: fingerprint})
  if (!storage.supported()) return empty()
  // A base that cannot be read is replaced by the next save.
  return storage
    .open(Database, {
      branch: fingerprint,
      choose: bases =>
        bases.find(base => base.branch === fingerprint) ?? bases[0]
    })
    .catch(empty)
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
