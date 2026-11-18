import type {
  GitObject,
  ObjectStore,
  ObjectType,
  StoredObject
} from '@alinea/graft'
import {requestResult, transactionComplete} from '#/core/util/IndexedDB.js'

const storeName = 'packs'
/** A batch smaller than this stays in memory until the next one is put. */
const recentLimit = 16 * 1024 * 1024
/** A pack is read whole when this much of it is asked for. */
const wholeShare = 0.25

/** The objects of one put, their data in one Blob. */
interface Pack {
  shas: Array<string>
  types: Array<ObjectType>
  /** Where the data of each object ends in `data` */
  ends: Array<number>
  data: Blob
}

interface Located {
  pack: Pack
  index: number
}

/**
 * Git objects in IndexedDB. Each put is stored as one record holding all
 * of its objects, as writing a record per object takes a millisecond for
 * every few. They never change, so stores of any number of workers and
 * dashboard builds share them. A sync compares trees and reads the blobs it
 * just stored: trees, small next to blobs, and the last batch stored are
 * kept in memory.
 */
export class IndexedDBObjects implements ObjectStore {
  #factory: IDBFactory
  #name: string
  #connection: Promise<IDBDatabase> | undefined
  #located = new Map<string, Located>()
  /** The last pack key read, as other stores add packs too */
  #lastKey: IDBValidKey | undefined
  #trees = new Map<string, GitObject>()
  #recent = new Map<string, GitObject>()
  /** The pack read whole last, shared by the reads of one sync */
  #whole: {pack: Pack; data: Promise<Uint8Array>} | undefined

  constructor(factory: IDBFactory, name: string) {
    this.#factory = factory
    this.#name = name
  }

  #connect(): Promise<IDBDatabase> {
    return (this.#connection ??= this.#open())
  }

  async #open(): Promise<IDBDatabase> {
    const request = this.#factory.open(this.#name)
    request.onupgradeneeded = () =>
      request.result.createObjectStore(storeName, {autoIncrement: true})
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

  /** Index the packs stored since the last read. */
  async #refresh(): Promise<void> {
    const db = await this.#connect()
    const store = db.transaction(storeName, 'readonly').objectStore(storeName)
    const range =
      this.#lastKey === undefined
        ? undefined
        : IDBKeyRange.lowerBound(this.#lastKey, true)
    const [keys, packs] = await Promise.all([
      requestResult(store.getAllKeys(range)),
      requestResult<Array<Pack>>(store.getAll(range))
    ])
    for (const pack of packs) this.#index(pack)
    this.#lastKey = keys.at(-1) ?? this.#lastKey ?? 0
  }

  #index(pack: Pack): void {
    for (const [index, sha] of pack.shas.entries())
      this.#located.set(sha, {pack, index})
  }

  #holds(sha: string): boolean {
    return this.#located.has(sha) || this.#trees.has(sha)
  }

  /** Read the packs other stores added when one of the shas is unknown. */
  async #locate(shas: ReadonlyArray<string>): Promise<void> {
    if (this.#lastKey === undefined || !shas.every(sha => this.#holds(sha)))
      await this.#refresh()
  }

  async get(shas: ReadonlyArray<string>): Promise<Map<string, GitObject>> {
    const result = new Map<string, GitObject>()
    const missing = Array<string>()
    for (const sha of shas) {
      const object = this.#trees.get(sha) ?? this.#recent.get(sha)
      if (object) result.set(sha, object)
      else missing.push(sha)
    }
    if (missing.length === 0) return result
    await this.#locate(missing)
    const byPack = new Map<Pack, Array<Located & {sha: string}>>()
    for (const sha of missing) {
      const located = this.#located.get(sha)
      if (!located) continue
      const list = byPack.get(located.pack) ?? []
      list.push({...located, sha})
      byPack.set(located.pack, list)
    }
    await Promise.all(
      Array.from(byPack, async ([pack, wanted]) => {
        const start = (index: number) => (index ? pack.ends[index - 1] : 0)
        const asked = wanted.reduce(
          (sum, {index}) => sum + pack.ends[index] - start(index),
          0
        )
        // Reads of a Blob cost a few each: a pack mostly asked for is read
        // at once
        const whole =
          asked >= pack.data.size * wholeShare
            ? await this.#read(pack)
            : undefined
        await Promise.all(
          wanted.map(async ({sha, index}) => {
            const from = start(index)
            const to = pack.ends[index]
            const data = whole
              ? whole.subarray(from, to)
              : new Uint8Array(await pack.data.slice(from, to).arrayBuffer())
            const object = {type: pack.types[index], data}
            if (object.type === 'tree') this.#trees.set(sha, object)
            result.set(sha, object)
          })
        )
      })
    )
    return result
  }

  /** A pack's data, kept for the reads that follow within a second. */
  #read(pack: Pack): Promise<Uint8Array> {
    if (this.#whole?.pack === pack) return this.#whole.data
    const data = pack.data.arrayBuffer().then(buffer => new Uint8Array(buffer))
    const whole = {pack, data}
    this.#whole = whole
    setTimeout(() => {
      if (this.#whole === whole) this.#whole = undefined
    }, 1000)
    return data
  }

  async has(shas: ReadonlyArray<string>): Promise<Set<string>> {
    await this.#locate(shas)
    return new Set(shas.filter(sha => this.#holds(sha)))
  }

  /** Stores all objects or none, in one record. */
  async put(objects: ReadonlyArray<StoredObject>): Promise<void> {
    await this.#locate(objects.map(object => object.sha))
    const added = new Map<string, StoredObject>()
    for (const object of objects)
      if (!this.#located.has(object.sha)) added.set(object.sha, object)
    if (added.size === 0) return
    const list = [...added.values()]
    const ends = Array<number>()
    let size = 0
    for (const {data} of list) ends.push((size += data.length))
    const pack: Pack = {
      shas: list.map(object => object.sha),
      types: list.map(object => object.type),
      ends,
      data: new Blob(list.map(object => object.data as Uint8Array<ArrayBuffer>))
    }
    const db = await this.#connect()
    // Durable before the index that needs them is stored
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).add(pack)
    await transactionComplete(tx)
    this.#index(pack)
    const recent = new Map<string, GitObject>()
    for (const {sha, type, data} of list)
      if (type === 'tree') this.#trees.set(sha, {type, data})
      else if (size < recentLimit) recent.set(sha, {type, data})
    this.#recent = recent
  }

  close(): void {
    const connection = this.#connection
    this.#connection = undefined
    connection?.then(db => db.close()).catch(() => {})
  }
}
