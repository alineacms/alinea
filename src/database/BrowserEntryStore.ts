import type {Config} from '#/core/Config.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import {HttpError} from '#/core/HttpError.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import type {ContentPack, RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {objectBlobs, treeObjects} from '#/core/source/TreeObjects.js'
import {isRecord} from '#/core/util/Objects.js'
import type {ObjectStore, StoredObject} from '@alinea/graft'
import {readPack} from '@alinea/graft/git'
import type {Database as WasmSqlite} from '@alinea/sqlite-wasm/Database.js'
import {
  indexedDBSnapshots,
  type Session,
  type SnapshotInfo,
  type SnapshotStorage
} from '@alinea/sqlite-wasm/snapshots'
import {sql} from 'rado'
import {databaseVersion, versionedCacheName} from './Version.js'
import {EntryDatabase} from './EntryDatabase.js'
import {EntryStore} from './EntryStore.js'
import {DatabaseSource} from './DatabaseSource.js'
import {wasmHandle, wasmSqlite} from './driver/WasmDatabase.js'
import {IndexedDBObjects} from './IndexedDBObjects.js'

/**
 * Page cache in KiB. Pages of a base are read from IndexedDB as queries need
 * them, at 0.5 to 2 ms each: a scan that does not fit the cache reads every
 * page again each time.
 */
const cacheSize = -65536

/** Bases of this many configs are kept; the newest is always among them. */
const keepBranches = 2

/**
 * A store starts over from an empty database, synced from scratch, once the
 * bases it builds on rewrote more than this many times the database's size.
 * Syncs write changed pages wherever there is room, scattering the tables
 * over the file, while reads of a base only read ahead well when its tables
 * are in order. A sync from scratch writes them in order.
 */
const rewriteLimit = 1

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
  /**
   * Where the git objects of the content are kept, in IndexedDB by default:
   * a remote that answers with packs then sends what changed since.
   */
  objects?: ObjectStore
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
  #objects: ObjectStore | undefined
  /** The remote answered a pack request as an older handler does */
  #packless = false
  /**
   * The entries were derived again from a base of another config. Refetching
   * everything after each deploy that changes the config costs more than
   * the layout that deriving leaves, so its first save is not counted.
   */
  #derived = false

  static async open(
    config: Config,
    options: BrowserEntryStoreOptions
  ): Promise<BrowserEntryStore> {
    const {name, fingerprint} = options
    const storage =
      options.storage ??
      indexedDBSnapshots(`${versionedCacheName(name)}-snapshots`)
    const objects =
      options.objects ??
      (!options.storage && globalThis.indexedDB
        ? new IndexedDBObjects(indexedDB, `${versionedCacheName(name)}-objects`)
        : undefined)
    // Other caches are deleted in the background, they don't affect this one.
    const cleanup =
      !options.storage && globalThis.indexedDB
        ? cleanupOldCaches(indexedDB, name).catch(() => {})
        : Promise.resolve()
    const Database = await wasmSqlite()
    const empty = () => storage.session(new Database(), {branch: fingerprint})
    let session = options.reset
      ? empty()
      : await openBase(storage, Database, fingerprint)
    const base = session.snapshot
    if (base && rewritten(base) > base.size * rewriteLimit) {
      await session.close()
      session = empty()
    }
    const store = await BrowserEntryStore.#on(
      config,
      session,
      storage,
      fingerprint,
      objects
    ).catch(error => {
      if (!session.snapshot) throw error
      // Start over from an empty database rather than one this build cannot
      // read or derive again.
      return BrowserEntryStore.#on(
        config,
        empty(),
        storage,
        fingerprint,
        objects
      )
    })
    store.#cleanup = cleanup
    return store
  }

  static async #on(
    config: Config,
    session: Session<WasmSqlite>,
    storage: SnapshotStorage,
    fingerprint: string,
    objects: ObjectStore | undefined
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
      const database = new EntryDatabase(config, db, {fork: preview, objects})
      // Content stored for another config is derived again for this one,
      // instead of syncing every entry from the remote into an empty
      // database.
      const derived = branch !== undefined && branch !== fingerprint
      if (derived) await withoutJournal(sqlite, () => database.reindex(config))
      const store = new BrowserEntryStore(config, database, session, storage)
      store.#derived = derived
      store.#objects = objects
      return store
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
    const synced =
      (await this.#syncPack(remote, options)) ??
      (await super.syncWith(remote, options))
    return this.#checkpoint(synced)
  }

  /**
   * Sync with one request: a pack of what changed since the content tree
   * whose objects this store holds. A store that holds none yet syncs its
   * trees and blobs as before, which compress better as a whole than a pack
   * without deltas, and keeps them as objects. Resolves to undefined for a
   * remote that sends no packs.
   */
  async #syncPack(
    remote: RemoteSource,
    options?: SyncOptions
  ): Promise<string | undefined> {
    const objects = this.#objects
    if (!objects || !remote.getPack || this.#packless) return undefined
    const revision = await this.database.getRevision()
    const holds =
      revision !== ReadonlyTree.EMPTY.sha &&
      (await objects.has([revision])).has(revision)
    let pack: ContentPack | undefined
    try {
      pack = await remote.getPack(holds ? revision : undefined)
    } catch (error) {
      const older =
        error instanceof HttpError && (error.code === 400 || error.code === 404)
      if (!older) throw error
      this.#packless = true
      return undefined
    }
    if (!pack) return revision
    if (!pack.pack) return this.#syncKeeping(remote, objects, options)
    let received: Awaited<ReturnType<typeof readPack>>
    try {
      received = await readPack(pack.pack, {bases: objects})
    } catch {
      // The objects lack a base the pack is a delta of, or hold another
      // version of it: ask for all of them
      pack = (await remote.getPack(ReadonlyTree.EMPTY.sha))!
      received = await readPack(pack.pack!)
    }
    // Stored before the index moves on, so they hold whatever it indexes
    await objects.put(received)
    const sha = pack.sha
    return super.syncWith(
      {
        async getHead() {
          return {sha, objects}
        },
        // An index the objects do not hold syncs as before
        getTreeIfDifferent: sha => remote.getTreeIfDifferent(sha),
        async *getBlobs(shas, options) {
          const missing = new Set(shas)
          for await (const [sha, blob] of objectBlobs(objects).getBlobs(
            shas,
            options
          )) {
            missing.delete(sha)
            yield [sha, blob]
          }
          if (missing.size) yield* remote.getBlobs([...missing], options)
        }
      },
      options
    )
  }

  /** Sync through trees and blobs, and keep them as objects. */
  async #syncKeeping(
    remote: RemoteSource,
    objects: ObjectStore,
    options?: SyncOptions
  ): Promise<string> {
    let tree: ReadonlyTree | undefined
    const blobs = Array<StoredObject>()
    const revision = await super.syncWith(
      {
        async getTreeIfDifferent(sha) {
          return (tree = await remote.getTreeIfDifferent(sha))
        },
        async *getBlobs(shas, options) {
          for await (const [sha, data] of remote.getBlobs(shas, options)) {
            blobs.push({sha, type: 'blob', data})
            yield [sha, data]
          }
        }
      },
      options
    )
    // An older handler serves the data of an index, which can differ from
    // the file: only exact blobs are kept
    const hashes = await Promise.all(blobs.map(blob => hashBlob(blob.data)))
    const exact = blobs.filter((blob, index) => hashes[index] === blob.sha)
    // An index synced before it kept objects lacks the unchanged blobs: a
    // pack that is a delta of one of them is then asked for whole
    if (tree?.sha === revision)
      await objects.put([...exact, ...treeObjects(tree)])
    return revision
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
    // A database synced from scratch starts counting what its bases rewrite
    const save = (key: string) =>
      this.database
        .whileIdle(async () => {
          if (!session.held) return undefined
          const base = session.snapshot
          const added = this.#derived ? 0 : session.held
          this.#derived = false
          const meta = {
            tree: revision,
            rewritten: base ? rewritten(base) + added : 0
          }
          return {saved: session.save({key, meta})}
        })
        .then(result => result?.saved)
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

/** The bytes the bases up to `base` rewrote since a sync from scratch. */
function rewritten(base: SnapshotInfo): number {
  const value = base.meta.rewritten
  return typeof value === 'number' ? value : 0
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
