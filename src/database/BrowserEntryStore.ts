import type {Config} from '#/core/Config.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {TaskQueue} from '#/core/util/Async.js'
import {requestResult, transactionComplete} from '#/core/util/IndexedDB.js'
import {versionedCacheName} from './Version.js'
import {EntryDatabase} from './EntryDatabase.js'
import {EntryStore} from './EntryStore.js'
import {DatabaseSource} from './DatabaseSource.js'
import {
  openWasmDatabase,
  type WasmDatabaseHandle
} from './driver/WasmDatabase.js'

const storeName = 'database'
const databaseKey = 'entries'

interface StoredDatabase {
  revision: string
  data: Uint8Array
}

export interface BrowserEntryStoreOptions {
  indexedDB: IDBFactory
  name: string
  revision: string
}

/** WASM entry store persisted as one SQLite file in IndexedDB. */
export class BrowserEntryStore extends EntryStore {
  #handle: WasmDatabaseHandle
  #cache: IDBDatabase
  #indexedDB: IDBFactory
  #baseName: string
  #cacheName: string
  #revision: string
  #persistedSha: string | undefined
  #persistQueue = new TaskQueue()
  #closed = false

  static async open(
    config: Config,
    options: BrowserEntryStoreOptions
  ): Promise<BrowserEntryStore> {
    const cacheName = versionedCacheName(options.name)
    const cache = await openCache(options.indexedDB, cacheName)
    const stored = await readDatabase(cache)
    const data = stored?.revision === options.revision ? stored.data : undefined
    let handle: WasmDatabaseHandle | undefined
    try {
      handle = await openWasmDatabase(data)
      await EntryDatabase.createSchema(handle.database, ReadonlyTree.EMPTY.sha)
      const database = new EntryDatabase(config, handle.database)
      return new BrowserEntryStore(
        config,
        database,
        handle,
        cache,
        options.indexedDB,
        options.name,
        cacheName,
        options.revision,
        data ? await database.getRevision() : undefined
      )
    } catch (error) {
      if (handle) await handle.database.close()
      if (data) {
        await deleteDatabase(cache)
        cache.close()
        return BrowserEntryStore.open(config, options)
      }
      cache.close()
      throw error
    }
  }

  private constructor(
    config: Config,
    database: EntryDatabase,
    handle: WasmDatabaseHandle,
    cache: IDBDatabase,
    indexedDB: IDBFactory,
    baseName: string,
    cacheName: string,
    revision: string,
    persistedSha: string | undefined
  ) {
    super(config, database, new DatabaseSource(database), {
      ownsDatabase: true,
      sourceFollowsDatabase: true
    })
    this.#handle = handle
    this.#cache = cache
    this.#indexedDB = indexedDB
    this.#baseName = baseName
    this.#cacheName = cacheName
    this.#revision = revision
    this.#persistedSha = persistedSha
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

  /** Persist the SQLite file after a task that moved this store's revision. */
  #persistAfter<T extends string | {sha: string}>(
    task: () => Promise<T>
  ): Promise<T> {
    if (this.#closed)
      return Promise.reject(new Error('BrowserEntryStore is closed'))
    return this.#persistQueue.run(async () => {
      const result = await task()
      await this.#save(typeof result === 'string' ? result : result.sha)
      return result
    })
  }

  async #save(sha: string): Promise<void> {
    if (sha === this.#persistedSha) return
    const record: StoredDatabase = {
      revision: this.#revision,
      data: this.#handle.export()
    }
    const transaction = this.#cache.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(record, databaseKey)
    await transactionComplete(transaction)
    this.#persistedSha = sha
  }

  override close(): Promise<void> {
    return this.#shutdown(true)
  }

  /** Close a superseded store without persisting stale bytes over its
   * replacement's cache. Supersede always implies a revision change, so the
   * persisted revision would be discarded on the next open anyway. */
  abandon(): Promise<void> {
    return this.#shutdown(false)
  }

  #shutdown(persist: boolean): Promise<void> {
    if (this.#closed) return this.#persistQueue.drain()
    this.#closed = true
    return this.#persistQueue.run(async () => {
      try {
        if (persist) await this.#save(await this.sha)
      } finally {
        await this.#teardown()
      }
    })
  }

  async #teardown(): Promise<void> {
    try {
      await super.close()
    } finally {
      this.#cache.close()
      await cleanupOldCaches(this.#indexedDB, this.#baseName, this.#cacheName)
    }
  }
}

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

function openCache(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  const request = factory.open(name, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(storeName)
  return requestResult(request)
}

function readDatabase(db: IDBDatabase): Promise<StoredDatabase | undefined> {
  return requestResult<StoredDatabase | undefined>(
    db
      .transaction(storeName, 'readonly')
      .objectStore(storeName)
      .get(databaseKey)
  )
}

function deleteDatabase(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction(storeName, 'readwrite')
  transaction.objectStore(storeName).delete(databaseKey)
  return transactionComplete(transaction)
}
