import {createId} from '#/core/Id.js'
import {Permission} from '#/core/Role.js'
import {entryIndexRow, type IndexedEntry} from '../entry/Schema.js'
import {
  type PayloadRequest,
  type SerializedPayload
} from '../runtime/EntryRuntime.js'
import {idbResult as result, idbTransaction} from './IndexedDB.js'

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

export interface ReplicaScope {
  project: string
  namespace: string
  epoch: string
  principal: string
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

export interface CachedPayload extends SerializedPayload {}

export interface CachedSnapshot {
  revision: string | undefined
  entries: Array<CachedEntry>
}

interface State {
  generation: string
  revision?: string
}

function cacheName(identity: ReplicaIdentity): string {
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
  return `alinea-replica-3:${JSON.stringify(binding)}`
}

/** Incremental authorized index and exact-payload cache, never a SQLite copy. */
export class ReplicaCache {
  #db: IDBDatabase
  #generation: string
  #closed = false

  private constructor(db: IDBDatabase, generation: string) {
    this.#db = db
    this.#generation = generation
    db.onversionchange = () => this.close()
  }

  /** Logout fallback when a terminated worker cannot report the views it touched. */
  static async purgeScope(
    factory: IDBFactory,
    scope: ReplicaScope
  ): Promise<void> {
    const prefix = 'alinea-replica-3:'
    for (const {name} of await factory.databases()) {
      if (!name?.startsWith(prefix)) continue
      let binding: unknown
      try {
        binding = JSON.parse(name.slice(prefix.length))
      } catch {
        continue
      }
      if (
        !Array.isArray(binding) ||
        binding.length !== 8 ||
        !binding.every(value => typeof value === 'string' && value)
      )
        continue
      const [
        project,
        namespace,
        epoch,
        schemaId,
        configId,
        principal,
        viewId,
        releaseId
      ] = binding as Array<string>
      if (
        project !== scope.project ||
        namespace !== scope.namespace ||
        epoch !== scope.epoch ||
        principal !== scope.principal
      )
        continue
      const identity = {
        project,
        namespace,
        epoch,
        schemaId,
        configId,
        principal,
        viewId,
        releaseId
      }
      if (cacheName(identity) !== name) continue
      const cache = await ReplicaCache.open(factory, identity)
      try {
        await cache.purge()
      } finally {
        cache.close()
      }
    }
  }

  static async open(
    factory: IDBFactory,
    identity: ReplicaIdentity
  ): Promise<ReplicaCache> {
    const name = cacheName(identity)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 1)
      let blocked = false
      request.onblocked = () => {
        blocked = true
        reject(new Error('Replica cache upgrade blocked'))
      }
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        for (const store of ['state', 'entries', 'payloads'])
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

  matches(identity: ReplicaIdentity): boolean {
    return this.#db.name === cacheName(identity)
  }

  async #transaction<T>(
    mode: IDBTransactionMode,
    run: (tx: IDBTransaction) => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    if (this.#closed) throw new Error('Replica cache is closed')
    return idbTransaction(
      this.#db,
      ['state', 'entries', 'payloads'],
      mode,
      run,
      signal
    )
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
      const payloads = tx.objectStore('payloads')
      const changed = new Set<string>()
      for (const id of delta.removedVersionIds ?? []) {
        if (changed.has(id)) throw new Error('Duplicate entry in cache delta')
        changed.add(id)
        entries.delete(id)
        payloads.delete(id)
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
          payloads.delete(versionId)
        entries.put({entry, permissions, payloadId}, versionId)
      }
      tx.objectStore('state').put(
        {...state, revision: delta.toRevision},
        'current'
      )
    })
  }

  putPayloads(
    revision: string,
    payloads: ReadonlyArray<CachedPayload>,
    signal?: AbortSignal
  ): Promise<void> {
    return this.#transaction(
      'readwrite',
      async tx => {
        const state = await this.#state(tx)
        if (state.revision !== revision)
          throw new Error('Stale replica payload response')
        const changed = new Set<string>()
        const entries = tx.objectStore('entries')
        const indexed = await Promise.all(
          payloads.map(payload =>
            result<CachedEntry | undefined>(entries.get(payload.versionId))
          )
        )
        for (let index = 0; index < payloads.length; index++) {
          const payload = payloads[index]
          if (changed.has(payload.versionId))
            throw new Error('Duplicate cached payload')
          changed.add(payload.versionId)
          const entry = indexed[index]
          if (
            !entry?.payloadId ||
            entry.payloadId !== payload.payloadId ||
            !(entry.permissions & Permission.Read)
          )
            throw new Error(
              'Cached payload does not match a readable descriptor'
            )
          if (
            typeof payload.dataJson !== 'string' ||
            !payload.dataJson ||
            (payload.sourceJson !== undefined &&
              typeof payload.sourceJson !== 'string')
          )
            throw new Error('Invalid cached payload')
          tx.objectStore('payloads').put(
            {
              versionId: payload.versionId,
              payloadId: payload.payloadId,
              dataJson: payload.dataJson,
              sourceJson: payload.sourceJson
            },
            payload.versionId
          )
        }
      },
      signal
    )
  }

  getPayloads(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<Array<CachedPayload>> {
    return this.#transaction('readonly', async tx => {
      await this.#state(tx)
      const store = tx.objectStore('payloads')
      const cached = await Promise.all(
        requests.map(request =>
          result<CachedPayload | undefined>(store.get(request.versionId))
        )
      )
      const found: Array<CachedPayload> = []
      for (let index = 0; index < requests.length; index++) {
        const request = requests[index]
        const payload = cached[index]
        if (
          payload?.payloadId === request.payloadId &&
          typeof payload.dataJson === 'string' &&
          payload.dataJson &&
          (payload.sourceJson === undefined ||
            typeof payload.sourceJson === 'string')
        )
          found.push({
            ...request,
            dataJson: payload.dataJson,
            sourceJson: payload.sourceJson
          })
      }
      return found
    })
  }

  /** Keep an invalidation marker so other tabs cannot repopulate this generation. */
  async purge(): Promise<void> {
    await this.#transaction('readwrite', async tx => {
      await this.#state(tx)
      tx.objectStore('entries').clear()
      tx.objectStore('payloads').clear()
      tx.objectStore('state').put({generation: createId()}, 'current')
    })
    this.close()
  }

  close(): void {
    this.#closed = true
    this.#db.close()
  }
}
