import type {GitObject, ObjectStore, StoredObject} from '@alinea/graft'
import {requestResult, transactionComplete} from '#/core/util/IndexedDB.js'

const storeName = 'objects'

/**
 * Git objects in IndexedDB, by sha. They never change, so stores of any
 * number of workers and dashboard builds share them.
 */
export class IndexedDBObjects implements ObjectStore {
  #factory: IDBFactory
  #name: string
  #connection: Promise<IDBDatabase> | undefined

  constructor(factory: IDBFactory, name: string) {
    this.#factory = factory
    this.#name = name
  }

  #connect(): Promise<IDBDatabase> {
    return (this.#connection ??= this.#open())
  }

  async #open(): Promise<IDBDatabase> {
    const request = this.#factory.open(this.#name)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    const db = await requestResult(request)
    db.onclose = () => {
      this.#connection = undefined
    }
    // Another version deleting the database closes this connection
    db.onversionchange = () => {
      db.close()
      this.#connection = undefined
    }
    return db
  }

  async get(shas: ReadonlyArray<string>): Promise<Map<string, GitObject>> {
    const db = await this.#connect()
    const store = db.transaction(storeName, 'readonly').objectStore(storeName)
    const found = await Promise.all(
      shas.map(sha => requestResult<GitObject | undefined>(store.get(sha)))
    )
    const result = new Map<string, GitObject>()
    for (const [index, object] of found.entries())
      if (object) result.set(shas[index], object)
    return result
  }

  async has(shas: ReadonlyArray<string>): Promise<Set<string>> {
    const db = await this.#connect()
    const store = db.transaction(storeName, 'readonly').objectStore(storeName)
    const keys = await Promise.all(
      shas.map(sha => requestResult(store.getKey(sha)))
    )
    return new Set(shas.filter((_, index) => keys[index] !== undefined))
  }

  /** Stores all objects or none, in one transaction. */
  async put(objects: ReadonlyArray<StoredObject>): Promise<void> {
    if (objects.length === 0) return
    const db = await this.#connect()
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    for (const {sha, type, data} of objects) {
      // A view is stored with all of its buffer
      const whole = data.byteLength === data.buffer.byteLength
      store.put({type, data: whole ? data : data.slice()}, sha)
    }
    await transactionComplete(tx)
  }

  close(): void {
    const connection = this.#connection
    this.#connection = undefined
    connection?.then(db => db.close()).catch(() => {})
  }
}
