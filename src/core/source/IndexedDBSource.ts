import type {ChangesBatch} from './Change.js'
import {ShaMismatchError} from './ShaMismatchError.js'
import type {Source} from './Source.js'
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
      const tree = await new Promise<ReadonlyTree>((resolve, reject) => {
        const transaction = db.transaction(['tree'], 'readonly')
        const store = transaction.objectStore('tree')
        const request = store.get('tree')
        request.onsuccess = event => {
          const entry = (event.target as IDBRequest).result
          resolve(entry ? new ReadonlyTree(entry) : ReadonlyTree.EMPTY)
        }
        request.onerror = event => reject((event.target as IDBRequest).error)
      })
      // Check if we have a valid tree
      // TODO: do this in a single transaction
      const blobKeys = await new Promise<Array<string>>((resolve, reject) => {
        const transaction = db.transaction(['blobs'], 'readonly')
        const blobs = transaction.objectStore('blobs')
        const request = blobs.getAllKeys()
        request.onsuccess = () => resolve(request.result as Array<string>)
        request.onerror = event => reject((event.target as IDBRequest).error)
      })
      for (const sha of tree.shas) {
        if (!blobKeys.includes(sha)) {
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
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const db = await this.#connect()
    const transaction = db.transaction(['blobs'], 'readonly')
    const store = transaction.objectStore('blobs')
    for (const sha of shas) {
      const request = store.get(sha)
      yield new Promise<[sha: string, blob: Uint8Array]>((resolve, reject) => {
        request.onsuccess = event => {
          const entry = (event.target as IDBRequest).result
          if (entry) resolve([sha, entry])
          else reject(new Error(`Blob not found: ${sha}`))
        }
        request.onerror = event => reject((event.target as IDBRequest).error)
      })
    }
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
