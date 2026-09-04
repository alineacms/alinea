import type {ChangesBatch} from './Change.js'
import {ShaMismatchError} from './ShaMismatchError.js'
import type {GetBlobsOptions, Source} from './Source.js'
import {ReadonlyTree} from './Tree.js'

export class IndexedDBSource implements Source {
  #factory: IDBFactory
  #name: string
  #connection: Promise<IDBDatabase> | undefined

  constructor(indexedDB: IDBFactory, name: string) {
    this.#factory = indexedDB
    this.#name = name
  }

  #createConnection(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.#factory.open(this.#name)
      request.onsuccess = () => {
        const db = request.result
        db.onclose = () => {
          console.info('IndexedDB connection closed')
          this.#connection = undefined
        }
        resolve(db)
      }
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        const db = request.result
        db.createObjectStore('blobs')
        db.createObjectStore('tree')
      }
    })
  }

  #connect(): Promise<IDBDatabase> {
    this.#connection ??= this.#createConnection()
    return this.#connection
  }

  #retryIfClosing<T extends Function>(handle: T) {
    return (error: Error) => {
      if (error instanceof Error && error.message.includes('closing')) {
        // If the database is closing, we retry the operation handle
        this.#connection = undefined
        return handle()
      }
      throw error
    }
  }

  getTree(): Promise<ReadonlyTree> {
    const handle = async () => {
      const db = await this.#connect()
      const transaction = db.transaction(['tree', 'blobs'], 'readonly')
      const treeStore = transaction.objectStore('tree')
      const blobsStore = transaction.objectStore('blobs')
      const [tree, blobKeys] = await Promise.all([
        new Promise<ReadonlyTree>((resolve, reject) => {
          const request = treeStore.get('tree')
          request.onsuccess = event => {
            const entry = (event.target as IDBRequest).result
            resolve(entry ? new ReadonlyTree(entry) : ReadonlyTree.EMPTY)
          }
          request.onerror = event => reject((event.target as IDBRequest).error)
        }),
        new Promise<Array<string>>((resolve, reject) => {
          const request = blobsStore.getAllKeys()
          request.onsuccess = () => resolve(request.result as Array<string>)
          request.onerror = event => reject((event.target as IDBRequest).error)
        })
      ])
      const availableBlobs = new Set(blobKeys)
      for (const sha of tree.shas) {
        if (!availableBlobs.has(sha)) {
          console.warn(`Blob ${sha} in tree, but not found`)
          return ReadonlyTree.EMPTY
        }
      }
      return tree
    }
    return handle().catch(this.#retryIfClosing(handle))
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const current = await this.getTree()
    return current.sha === sha ? undefined : current
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    if (shas.length === 0) return
    const db = await this.#connect()
    const transaction = db.transaction(['blobs'], 'readonly')
    const store = transaction.objectStore('blobs')
    const [keys, values] = await Promise.all([
      new Promise<Array<IDBValidKey>>((resolve, reject) => {
        const request = store.getAllKeys()
        request.onsuccess = () => resolve(request.result)
        request.onerror = event => reject((event.target as IDBRequest).error)
      }),
      new Promise<Array<Uint8Array>>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result as Array<Uint8Array>)
        request.onerror = event => reject((event.target as IDBRequest).error)
      })
    ])
    const missing = new Set(shas)
    for (let index = 0; index < keys.length; index++) {
      if (options.signal?.aborted)
        throw options.signal.reason ?? new Error('Blob transfer aborted')
      const key = keys[index]
      const value = values[index]
      if (typeof key === 'string' && value !== undefined && missing.delete(key))
        yield [key, value]
    }
    const sha = missing.values().next().value
    if (sha !== undefined) throw new Error(`Blob not found: ${sha}`)
  }

  async applyChanges(batch: ChangesBatch) {
    const db = await this.#connect()
    const current = await this.getTree()
    if (batch.fromSha !== current.sha)
      throw new ShaMismatchError(
        current.sha,
        batch.fromSha,
        'Cannot apply changes locally due to SHA mismatch'
      )
    const updatedTree = current.clone()
    updatedTree.applyChanges(batch)
    const compiled = await updatedTree.compile()
    const transaction = db.transaction(['blobs', 'tree'], 'readwrite')
    const blobs = transaction.objectStore('blobs')
    const tree = transaction.objectStore('tree')
    tree.put(compiled.toJSON(), 'tree')
    for (const change of batch.changes)
      switch (change.op) {
        case 'add':
          blobs.put(change.contents, change.sha)
          break
      }
    const blobKeys = await new Promise<Array<string>>((resolve, reject) => {
      const request = blobs.getAllKeys()
      request.onsuccess = () => resolve(request.result as Array<string>)
      request.onerror = event => reject((event.target as IDBRequest).error)
    })
    for (const sha of blobKeys) {
      if (!compiled.hasSha(sha)) blobs.delete(sha)
    }
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = event => reject((event.target as IDBRequest).error)
    })
  }
}
