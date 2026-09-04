import type {ReplicaSnapshotState} from './Types.js'

const STATES = 'states'

/** Persistent dashboard cache; catalogs are installed with one atomic put. */
export class IndexedDBReplicaCache {
  #factory: IDBFactory
  #name: string
  #connection?: Promise<IDBDatabase>

  constructor(factory: IDBFactory, name = 'alinea-replica') {
    this.#factory = factory
    this.#name = name
  }

  async installState(
    scope: string,
    state: ReplicaSnapshotState
  ): Promise<void> {
    await this.#write(STATES, scope, state)
  }

  state(scope: string): Promise<ReplicaSnapshotState | undefined> {
    return this.#read(STATES, scope)
  }

  async #connect(): Promise<IDBDatabase> {
    if (!this.#connection) {
      this.#connection = new Promise((resolve, reject) => {
        const request = this.#factory.open(this.#name, 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
        request.onupgradeneeded = () => {
          const database = request.result
          database.createObjectStore(STATES)
        }
      })
    }
    return this.#connection
  }

  async #read<Value>(
    storeName: string,
    key: string
  ): Promise<Value | undefined> {
    const database = await this.#connect()
    return new Promise((resolve, reject) => {
      const request = database
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .get(key)
      request.onsuccess = () => resolve(request.result as Value | undefined)
      request.onerror = () => reject(request.error)
    })
  }

  async #write(storeName: string, key: string, value: unknown): Promise<void> {
    const database = await this.#connect()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).put(value, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
}
