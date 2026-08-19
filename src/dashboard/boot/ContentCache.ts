import type {ContentEntry, ContentState} from '#/core/ContentSync.js'

const stateKey = 'current'

export class ContentCache {
  #connection: Promise<IDBDatabase> | undefined

  constructor(
    private factory: IDBFactory,
    private name: string
  ) {}

  #connect(): Promise<IDBDatabase> {
    this.#connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(this.name, 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('state'))
          db.createObjectStore('state')
        if (!db.objectStoreNames.contains('objects'))
          db.createObjectStore('objects')
      }
    })
    return this.#connection
  }

  async getState(): Promise<ContentState | undefined> {
    const db = await this.#connect()
    const transaction = db.transaction('state', 'readonly')
    return requestValue<ContentState | undefined>(
      transaction.objectStore('state').get(stateKey)
    )
  }

  async getObjects(
    hashes: Array<string>
  ): Promise<Record<string, ContentEntry>> {
    if (hashes.length === 0) return {}
    const db = await this.#connect()
    const transaction = db.transaction('objects', 'readonly')
    const store = transaction.objectStore('objects')
    const values = await Promise.all(
      hashes.map(hash =>
        requestValue<ContentEntry | undefined>(store.get(hash))
      )
    )
    const result: Record<string, ContentEntry> = {}
    for (let index = 0; index < hashes.length; index++) {
      const value = values[index]
      if (value) result[hashes[index]] = value
    }
    return result
  }

  async put(
    state: ContentState,
    objects: Record<string, ContentEntry>
  ): Promise<void> {
    const db = await this.#connect()
    const transaction = db.transaction(['state', 'objects'], 'readwrite')
    const stateStore = transaction.objectStore('state')
    const objectStore = transaction.objectStore('objects')
    for (const [hash, object] of Object.entries(objects))
      objectStore.put(object, hash)
    stateStore.put(state, stateKey)
    await transactionComplete(transaction)
  }
}

function requestValue<T>(request: IDBRequest): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error)
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}
