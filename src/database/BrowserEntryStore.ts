import type {Config} from '#/core/Config.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {RemoteSource, Source} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {EntryDatabase} from './EntryDatabase.js'
import {EntryStore} from './EntryStore.js'
import {
  openWasmDatabase,
  type WasmDatabaseHandle
} from './driver/WasmDatabase.js'

const schemaVersion = 2
const storeName = 'database'
const databaseKey = 'entries'

interface StoredDatabase {
  revision: string
  schemaVersion: number
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
  #revision: string
  #persistedSha: string | undefined
  #persistQueue: Promise<unknown> = Promise.resolve()
  #closed = false

  static async open(
    config: Config,
    source: Source,
    options: BrowserEntryStoreOptions
  ): Promise<BrowserEntryStore> {
    const cache = await openCache(options.indexedDB, options.name)
    const stored = await readDatabase(cache)
    const data =
      stored?.revision === options.revision &&
      stored.schemaVersion === schemaVersion
        ? stored.data
        : undefined
    let handle: WasmDatabaseHandle | undefined
    try {
      handle = await openWasmDatabase(data)
      await EntryDatabase.createSchema(handle.database, ReadonlyTree.EMPTY.sha)
      const database = new EntryDatabase(config, handle.database)
      return new BrowserEntryStore(
        config,
        database,
        source,
        handle,
        cache,
        options.revision,
        data ? await database.getRevision() : undefined
      )
    } catch (error) {
      if (handle) await handle.database.close()
      if (data) {
        await deleteDatabase(cache)
        cache.close()
        return BrowserEntryStore.open(config, source, options)
      }
      cache.close()
      throw error
    }
  }

  private constructor(
    config: Config,
    database: EntryDatabase,
    source: Source,
    handle: WasmDatabaseHandle,
    cache: IDBDatabase,
    revision: string,
    persistedSha: string | undefined
  ) {
    super(config, database, source, {ownsDatabase: true})
    this.#handle = handle
    this.#cache = cache
    this.#revision = revision
    this.#persistedSha = persistedSha
  }

  override sync(): Promise<string> {
    return this.#persist(async () => {
      const sha = await super.sync()
      await this.#save(sha)
      return sha
    })
  }

  override syncWith(remote: RemoteSource): Promise<string> {
    return this.#persist(async () => {
      const sha = await super.syncWith(remote)
      await this.#save(sha)
      return sha
    })
  }

  override mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.#persist(async () => {
      const result = await super.mutate(mutations)
      await this.#save(result.sha)
      return result
    })
  }

  override write(request: CommitRequest): Promise<{sha: string}> {
    return this.#persist(async () => {
      const result = await super.write(request)
      await this.#save(result.sha)
      return result
    })
  }

  #persist<T>(task: () => Promise<T>): Promise<T> {
    if (this.#closed)
      return Promise.reject(new Error('BrowserEntryStore is closed'))
    const result = this.#persistQueue.then(task)
    this.#persistQueue = result.catch(() => {})
    return result
  }

  async #save(sha: string): Promise<void> {
    if (sha === this.#persistedSha) return
    const record: StoredDatabase = {
      revision: this.#revision,
      schemaVersion,
      data: this.#handle.export()
    }
    const transaction = this.#cache.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(record, databaseKey)
    await transactionComplete(transaction)
    this.#persistedSha = sha
  }

  override close(): Promise<void> {
    if (this.#closed) return this.#persistQueue.then(() => {})
    this.#closed = true
    const result = this.#persistQueue.then(async () => {
      try {
        const sha = await this.sha
        await this.#save(sha)
      } finally {
        await super.close()
        this.#cache.close()
      }
    })
    this.#persistQueue = result.catch(() => {})
    return result
  }
}

function openCache(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readDatabase(db: IDBDatabase): Promise<StoredDatabase | undefined> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, 'readonly')
      .objectStore(storeName)
      .get(databaseKey)
    request.onsuccess = () => resolve(request.result as StoredDatabase)
    request.onerror = () => reject(request.error)
  })
}

function deleteDatabase(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction(storeName, 'readwrite')
  transaction.objectStore(storeName).delete(databaseKey)
  return transactionComplete(transaction)
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}
