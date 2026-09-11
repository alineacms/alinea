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

const schemaVersion = 1
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
    const handle = await openWasmDatabase(data)
    try {
      await EntryDatabase.createSchema(handle.database, ReadonlyTree.EMPTY.sha)
      return new BrowserEntryStore(
        config,
        new EntryDatabase(config, handle.database),
        source,
        handle,
        cache,
        options.revision
      )
    } catch (error) {
      await handle.database.close()
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
    revision: string
  ) {
    super(config, database, source, {ownsDatabase: true})
    this.#handle = handle
    this.#cache = cache
    this.#revision = revision
  }

  override async sync(): Promise<string> {
    const sha = await super.sync()
    await this.#save()
    return sha
  }

  override async syncWith(remote: RemoteSource): Promise<string> {
    const sha = await super.syncWith(remote)
    await this.#save()
    return sha
  }

  override async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    const result = await super.mutate(mutations)
    await this.#save()
    return result
  }

  override async write(request: CommitRequest): Promise<{sha: string}> {
    const result = await super.write(request)
    await this.#save()
    return result
  }

  async #save(): Promise<void> {
    const record: StoredDatabase = {
      revision: this.#revision,
      schemaVersion,
      data: this.#handle.export()
    }
    const transaction = this.#cache.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(record, databaseKey)
    await transactionComplete(transaction)
  }

  override async close(): Promise<void> {
    await this.#save()
    await super.close()
    this.#cache.close()
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

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}
