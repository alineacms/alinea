import type {ChangesBatch} from './Change.js'
import {assert} from '../util/Assert.js'
import {requestResult, transactionComplete} from '../util/IndexedDB.js'
import {ShaMismatchError} from './ShaMismatchError.js'
import type {GetBlobsOptions, RemoteSource, Source} from './Source.js'
import {ReadonlyTree, type Tree} from './Tree.js'

export class IndexedDBSource implements Source {
  #factory: IDBFactory
  #name: string
  #connection: Promise<IDBDatabase> | undefined

  constructor(indexedDB: IDBFactory, name: string) {
    this.#factory = indexedDB
    this.#name = name
  }

  async #createConnection(): Promise<IDBDatabase> {
    const request = this.#factory.open(this.#name)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('blobs')
      db.createObjectStore('tree')
    }
    const db = await requestResult(request)
    db.onclose = () => {
      console.info('IndexedDB connection closed')
      this.#connection = undefined
    }
    return db
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
      const [stored, blobKeys] = await Promise.all([
        requestResult<Tree | undefined>(treeStore.get('tree')),
        requestResult(blobsStore.getAllKeys())
      ])
      const tree = stored ? new ReadonlyTree(stored) : ReadonlyTree.EMPTY
      const availableBlobs = new Set(blobKeys)
      for (const sha of tree.index().values()) {
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
      requestResult(store.getAllKeys()),
      requestResult<Array<Uint8Array>>(store.getAll())
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
    const blobKeys = await requestResult(blobs.getAllKeys())
    for (const sha of blobKeys) {
      if (typeof sha === 'string' && !compiled.hasSha(sha)) blobs.delete(sha)
    }
    return transactionComplete(transaction)
  }

  async applyChangesFrom(
    remote: RemoteSource,
    batch: ChangesBatch,
    tree: ReadonlyTree
  ): Promise<void> {
    const db = await this.#connect()
    const current = await this.getTree()
    if (batch.fromSha !== current.sha)
      throw new ShaMismatchError(
        current.sha,
        batch.fromSha,
        'Cannot apply changes locally due to SHA mismatch'
      )
    const needed = new Set(
      batch.changes
        .filter(change => change.op === 'add')
        .map(change => change.sha)
    )
    let pending = Array<[string, Uint8Array]>()
    const flush = async () => {
      if (!pending.length) return
      const transaction = db.transaction('blobs', 'readwrite')
      const blobs = transaction.objectStore('blobs')
      for (const [sha, blob] of pending) blobs.put(blob, sha)
      pending = []
      await transactionComplete(transaction)
    }
    for await (const [sha, blob] of remote.getBlobs([...needed])) {
      if (!needed.delete(sha)) continue
      pending.push([sha, blob])
      if (pending.length >= 64) await flush()
    }
    await flush()
    const missing = needed.values().next().value
    assert(missing === undefined, `Source did not return blob ${missing}`)

    const transaction = db.transaction(['blobs', 'tree'], 'readwrite')
    const blobs = transaction.objectStore('blobs')
    transaction.objectStore('tree').put(tree.toJSON(), 'tree')
    const cursor = blobs.openKeyCursor()
    cursor.onsuccess = () => {
      const current = cursor.result
      if (!current) return
      const sha = current.key
      if (typeof sha === 'string' && !tree.hasSha(sha)) blobs.delete(sha)
      current.continue()
    }
    await transactionComplete(transaction)
  }
}
