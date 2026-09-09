import {createId} from '#/core/Id.js'
import {Permission} from '#/core/Role.js'
import {entryIndexRow, type IndexedEntry} from '../entry/Schema.js'
import type {PayloadRequest} from '../runtime/EntryRuntime.js'

/** Supplied only after the handler has authenticated the complete replica binding. */
export interface ReplicaIdentity {
  project: string
  namespace: string
  epoch: string
  schemaId: string
  configId: string
  principal: string
  viewId: string
  releaseId: string
}

export interface CachedEntry {
  entry: IndexedEntry
  permissions: number
  payloadId?: string
}

export interface CacheDelta {
  fromRevision: string | undefined
  toRevision: string
  entries: ReadonlyArray<CachedEntry>
  removedVersionIds?: ReadonlyArray<string>
}

export interface CachedFrame extends PayloadRequest {
  /** Opaque encrypted frame bytes; authentication/decryption belongs to the loader. */
  ciphertext: Uint8Array
}

export interface CachedSnapshot {
  revision: string | undefined
  entries: Array<CachedEntry>
}

interface State {
  generation: string
  revision?: string
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Incremental authorized-index/ciphertext cache, never a plaintext SQLite export. */
export class ReplicaCache {
  #db: IDBDatabase
  #generation: string
  #closed = false

  private constructor(db: IDBDatabase, generation: string) {
    this.#db = db
    this.#generation = generation
    db.onversionchange = () => this.close()
  }

  static async open(
    factory: IDBFactory,
    identity: ReplicaIdentity
  ): Promise<ReplicaCache> {
    const binding = [
      identity.project,
      identity.namespace,
      identity.epoch,
      identity.schemaId,
      identity.configId,
      identity.principal,
      identity.viewId,
      identity.releaseId
    ]
    if (binding.some(value => typeof value !== 'string' || !value))
      throw new Error('Incomplete replica identity')
    const name = `alinea-replica-1:${JSON.stringify(binding)}`
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 1)
      let blocked = false
      request.onblocked = () => {
        blocked = true
        reject(new Error('Replica cache upgrade blocked'))
      }
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        for (const store of ['state', 'entries', 'frames'])
          request.result.createObjectStore(store)
      }
      request.onsuccess = () => {
        if (blocked) request.result.close()
        else resolve(request.result)
      }
    })
    const cache = new ReplicaCache(db, '')
    try {
      cache.#generation = await cache.#transaction('readwrite', async tx => {
        const store = tx.objectStore('state')
        const state = await result<State | undefined>(store.get('current'))
        if (state) return state.generation
        const generation = createId()
        store.put({generation}, 'current')
        return generation
      })
      return cache
    } catch (error) {
      cache.close()
      throw error
    }
  }

  async #transaction<T>(
    mode: IDBTransactionMode,
    run: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    if (this.#closed) throw new Error('Replica cache is closed')
    const tx = this.#db.transaction(['state', 'entries', 'frames'], mode)
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () =>
        reject(tx.error ?? new Error('Replica cache transaction aborted'))
    })
    // Requests may reject before run() finishes handling their errors.
    void done.catch(() => {})
    try {
      const value = await run(tx)
      await done
      return value
    } catch (error) {
      try {
        tx.abort()
      } catch {}
      await done.catch(() => {})
      throw error
    }
  }

  async #state(tx: IDBTransaction): Promise<State> {
    const state = await result<State | undefined>(
      tx.objectStore('state').get('current')
    )
    if (state?.generation !== this.#generation)
      throw new Error('Replica cache was invalidated')
    return state
  }

  snapshot(): Promise<CachedSnapshot> {
    return this.#transaction('readonly', async tx => {
      const state = await this.#state(tx)
      const entries = await result<Array<CachedEntry>>(
        tx.objectStore('entries').getAll()
      )
      return {revision: state.revision, entries}
    })
  }

  apply(delta: CacheDelta): Promise<void> {
    return this.#transaction('readwrite', async tx => {
      const state = await this.#state(tx)
      if (state.revision !== delta.fromRevision)
        throw new Error('Replica cache revision mismatch')
      if (!delta.toRevision || delta.toRevision === delta.fromRevision)
        throw new Error('A cache delta must advance the revision')
      const entries = tx.objectStore('entries')
      const frames = tx.objectStore('frames')
      const changed = new Set<string>()
      for (const id of delta.removedVersionIds ?? []) {
        if (changed.has(id)) throw new Error('Duplicate entry in cache delta')
        changed.add(id)
        entries.delete(id)
        frames.delete(id)
      }
      for (const replacement of delta.entries) {
        const {permissions, payloadId} = replacement
        if (
          !Number.isInteger(permissions) ||
          permissions < 0 ||
          permissions > Permission.All ||
          !(permissions & Permission.Explore)
        )
          throw new Error('Cached entries require compiled explore permissions')
        if (
          payloadId !== undefined &&
          (!(permissions & Permission.Read) ||
            typeof payloadId !== 'string' ||
            !payloadId)
        )
          throw new Error('Payload identity requires read permission')
        // Whitelist structural columns: callers may pass an Entry with extra data.
        const {versionId, ...entry} = entryIndexRow(replacement.entry)
        if (changed.has(versionId))
          throw new Error('Duplicate entry in cache delta')
        changed.add(versionId)
        const previous = await result<CachedEntry | undefined>(
          entries.get(versionId)
        )
        if (previous?.payloadId !== payloadId || !payloadId)
          frames.delete(versionId)
        entries.put({entry, permissions, payloadId}, versionId)
      }
      tx.objectStore('state').put(
        {...state, revision: delta.toRevision},
        'current'
      )
    })
  }

  putFrames(
    revision: string,
    frames: ReadonlyArray<CachedFrame>
  ): Promise<void> {
    return this.#transaction('readwrite', async tx => {
      const state = await this.#state(tx)
      if (state.revision !== revision)
        throw new Error('Stale replica payload response')
      const changed = new Set<string>()
      for (const frame of frames) {
        if (changed.has(frame.versionId))
          throw new Error('Duplicate cached frame')
        changed.add(frame.versionId)
        const entry = await result<CachedEntry | undefined>(
          tx.objectStore('entries').get(frame.versionId)
        )
        if (
          !entry?.payloadId ||
          entry.payloadId !== frame.payloadId ||
          !(entry.permissions & Permission.Read)
        )
          throw new Error('Cached frame does not match a readable descriptor')
        if (
          !(frame.ciphertext instanceof Uint8Array) ||
          !frame.ciphertext.byteLength
        )
          throw new Error('Missing encrypted frame bytes')
        tx.objectStore('frames').put(
          {
            versionId: frame.versionId,
            payloadId: frame.payloadId,
            ciphertext: frame.ciphertext
          },
          frame.versionId
        )
      }
    })
  }

  getFrames(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<Array<CachedFrame>> {
    return this.#transaction('readonly', async tx => {
      await this.#state(tx)
      const found: Array<CachedFrame> = []
      for (const request of requests) {
        const frame = await result<CachedFrame | undefined>(
          tx.objectStore('frames').get(request.versionId)
        )
        if (frame?.payloadId === request.payloadId) found.push(frame)
      }
      return found
    })
  }

  /** Keep an invalidation marker so other tabs cannot repopulate this generation. */
  async purge(): Promise<void> {
    await this.#transaction('readwrite', async tx => {
      await this.#state(tx)
      tx.objectStore('entries').clear()
      tx.objectStore('frames').clear()
      tx.objectStore('state').put({generation: createId()}, 'current')
    })
    this.close()
  }

  close(): void {
    this.#closed = true
    this.#db.close()
  }
}
