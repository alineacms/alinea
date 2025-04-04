import type {Change} from './Change.js'
import type {Source} from './Source.js'
import {ReadonlyTree} from './Tree.js'

export class IndexedDBSource implements Source {
  #db: Promise<IDBDatabase>

  constructor(indexedDB: IDBFactory, name: string) {
    this.#db = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        const db = request.result
        db.createObjectStore('blobs')
        db.createObjectStore('tree')
      }
    })
  }

  async getTree() {
    const db = await this.#db
    return new Promise<ReadonlyTree>((resolve, reject) => {
      const transaction = db.transaction(['tree'], 'readonly')
      const store = transaction.objectStore('tree')
      const request = store.get('tree')
      request.onsuccess = event => {
        const entry = (event.target as IDBRequest).result
        resolve(entry ? new ReadonlyTree(entry) : ReadonlyTree.EMPTY)
      }
      request.onerror = event => reject((event.target as IDBRequest).error)
    })
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const current = await this.getTree()
    return current.sha === sha ? undefined : current
  }

  async getBlobs(
    shas: Array<string>
  ): Promise<Array<[sha: string, blob: Uint8Array]>> {
    const db = await this.#db
    return new Promise<Array<[sha: string, blob: Uint8Array]>>(
      (resolve, reject) => {
        const transaction = db.transaction(['blobs'], 'readonly')
        const store = transaction.objectStore('blobs')
        const blobs: Array<[sha: string, blob: Uint8Array]> = []
        const tasks = Array<Promise<void>>()
        for (const sha of shas) {
          const request = store.get(sha)
          tasks.push(
            new Promise<void>(resolve => {
              request.onsuccess = event => {
                const entry = (event.target as IDBRequest).result
                if (entry) blobs.push([sha, entry])
                resolve()
              }
              request.onerror = event =>
                reject((event.target as IDBRequest).error)
            })
          )
        }
        transaction.oncomplete = () => resolve(blobs)
      }
    )
  }

  async applyChanges(changes: Array<Change>) {
    const db = await this.#db
    const current = await this.getTree()
    const updatedTree = current.clone()
    updatedTree.applyChanges(changes)
    const compiled = await updatedTree.compile()
    const transaction = db.transaction(['blobs', 'tree'], 'readwrite')
    const blobs = transaction.objectStore('blobs')
    const tree = transaction.objectStore('tree')
    tree.put(compiled.toJSON(), 'tree')
    for (const change of changes)
      switch (change.op) {
        case 'add':
          blobs.put(change.contents, change.sha)
          break
        case 'delete':
          blobs.delete(change.sha)
          break
      }
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = event => reject((event.target as IDBRequest).error)
    })
  }
}
