import type {Config} from '#/core/Config.js'
import type {ContentEntry, ContentState} from '#/core/ContentSync.js'
import type {LocalConnection} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {getScope} from '#/core/Scope.js'
import {trigger} from '#/core/Trigger.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {EntryUrlConflictError} from '#/core/db/EntryUrlConflictError.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {IndexedDBSource} from '#/core/source/IndexedDBSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import type {Source} from '#/core/source/Source.js'
import pLimit from 'p-limit'
import {ContentCache} from './ContentCache.js'
import {ContentStateEvent} from './ContentStateEvent.js'
import {
  MutationQueueEvent,
  type MutationQueueEntry,
  type MutationQueueMutation
} from './MutationQueueEvent.js'

const remote = pLimit(1)
const syncInterval = 120_000

interface MutationQueueItem extends MutationQueueEntry {
  mutations: Array<Mutation>
  mutationSummaries: Array<MutationQueueMutation>
  attempt: number
  sha?: string
  committed?: boolean
}

export class DashboardWorker extends EventTarget {
  #source: Source | undefined
  #indexedDB: IDBFactory | undefined
  #contentCache: ContentCache | undefined
  #cacheKey: string | undefined
  #configId: string | undefined
  #localDB: LocalDB | undefined
  #localClient: LocalConnection | undefined
  #nextLoad = trigger<{db: LocalDB; client: LocalConnection}>()
  #defer: Function | undefined
  #currentRevision: string | undefined
  #queue: Array<MutationQueueItem> = []
  #local = pLimit(1)
  #blocked = false
  #syncInterval: ReturnType<typeof setInterval> | undefined

  constructor(source: Source | IDBFactory) {
    super()
    if ('getTree' in source) this.#source = source
    else this.#indexedDB = source
  }

  get db() {
    return this.#localDB ?? this.#nextLoad.then(res => res.db)
  }

  get #client() {
    return this.#localClient ?? this.#nextLoad.then(res => res.client)
  }

  async sync() {
    const db = await this.db
    const client = await this.#client
    if (
      this.#local.activeCount > 0 ||
      this.#local.pendingCount > 0 ||
      remote.activeCount > 0 ||
      remote.pendingCount > 0
    )
      return db.sha
    return remote(() => this.#refresh(db, client))
  }

  async sha() {
    return (await this.db).sha
  }

  async queue(id: string, mutations: Array<Mutation>): Promise<string> {
    return this.#local(async () => {
      const db = await this.db
      if (this.#blocked) {
        throw new Error('Resolve the sync error before making more changes')
      }
      const mutationSummaries = await summarizeMutations(db, mutations)
      const item: MutationQueueItem = {
        id,
        mutations,
        mutationSummaries,
        status: 'pending',
        attempt: 0
      }
      this.#queue.push(item)
      this.#emitQueue()
      try {
        item.status = 'syncing'
        this.#emitQueue()
        const client = await this.#client
        await remote(() => client.mutate(mutations))
        item.committed = true
        item.sha = await remote(() => this.#refresh(db, client, true))
        this.#removeQueueItem(item)
        return item.sha
      } catch (error) {
        if (error instanceof EntryUrlConflictError) {
          this.#removeQueueItem(item)
          throw error
        }
        this.#blocked = true
        item.status = 'failed'
        item.error = errorMessage(error)
        this.#emitQueue()
        throw error
      }
    })
  }

  async retryQueue(): Promise<void> {
    if (!this.#blocked) return
    await this.#local(async () => {
      const db = await this.db
      const client = await this.#client
      this.#blocked = false
      for (const item of [...this.#queue]) {
        item.attempt += 1
        item.status = 'syncing'
        item.error = undefined
        this.#emitQueue()
        try {
          if (!item.committed) {
            await remote(() => client.mutate(item.mutations))
            item.committed = true
          }
          item.sha = await remote(() => this.#refresh(db, client, true))
          this.#removeQueueItem(item)
        } catch (error) {
          this.#blocked = true
          item.status = 'failed'
          item.error = errorMessage(error)
          this.#emitQueue()
          throw error
        }
      }
    })
  }

  async discardQueue(): Promise<void> {
    await this.#local(async () => {
      if (this.#queue.length === 0) return
      const committed = this.#queue.some(item => item.committed)
      if (committed) {
        const db = await this.db
        const client = await this.#client
        await remote(() => this.#refresh(db, client, true))
      }
      for (const item of this.#queue) item.attempt += 1
      this.#blocked = false
      this.#queue = []
      this.#emitQueue()
    })
  }

  #removeQueueItem(item: MutationQueueItem) {
    this.#queue = this.#queue.filter(entry => entry !== item)
    this.#emitQueue()
  }

  #emitQueue() {
    this.dispatchEvent(
      new MutationQueueEvent(
        this.#queue.map(({id, status, mutationSummaries, error}) => ({
          id,
          status,
          mutations: mutationSummaries,
          error
        }))
      )
    )
  }

  async resolve(raw: string): Promise<unknown> {
    const db = await this.db
    const scope = getScope(db.config)
    const query = scope.parse<GraphQuery>(raw)
    return db.resolve(query)
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    const db = await this.db
    return db.referencesTo(query)
  }

  async load(
    revision: string,
    config: Config,
    client: LocalConnection,
    cacheKey?: string,
    configId?: string
  ) {
    if (
      this.#currentRevision === revision &&
      this.#cacheKey === cacheKey &&
      this.#configId === configId
    ) {
      this.#localClient = client
      await this.sync()
      return
    }
    this.#currentRevision = revision
    if (this.#cacheKey !== cacheKey) this.#contentCache = undefined
    this.#cacheKey = cacheKey
    this.#configId = configId
    const contentClient = isContentClient(client) && cacheKey && this.#indexedDB
    const source = contentClient
      ? new MemorySource()
      : (this.#source ?? new IndexedDBSource(this.#indexedDB!, 'alinea'))
    const db = new LocalDB(config, source)
    try {
      if (this.#defer) this.#defer()
      let cacheReady = false
      if (contentClient) {
        await this.#syncContent(db, client, cacheKey)
        cacheReady = true
      } else {
        cacheReady = await this.#syncLocalIndex(db)
        if (!cacheReady) await remote(() => db.syncWith(client))
      }
      this.#localDB = db
      this.#localClient = client
      this.#nextLoad.resolve({db, client})
      const listen = (event: Event) => {
        if (event instanceof IndexEvent)
          this.dispatchEvent(new IndexEvent(event.data))
      }
      db.index.addEventListener(IndexEvent.type, listen)
      this.#defer = () => {
        db.index.removeEventListener(IndexEvent.type, listen)
      }
      this.#startSyncing(Boolean(cacheReady && !contentClient))
    } catch (cause) {
      this.#nextLoad.reject(new Error('Failed to load database', {cause}))
      throw cause
    }
  }

  async #syncLocalIndex(db: LocalDB): Promise<boolean> {
    const sourceTree = await db.source.getTree()
    if (sourceTree.isEmpty) return false
    try {
      await db.sync()
      return true
    } catch {
      return false
    }
  }

  #startSyncing(refreshImmediately: boolean) {
    if (this.#syncInterval) return
    const sync = () => {
      void this.sync().catch(() => {})
    }
    if (refreshImmediately) sync()
    this.#syncInterval = setInterval(sync, syncInterval)
  }

  async #refresh(
    db: LocalDB,
    client: LocalConnection,
    force = false
  ): Promise<string> {
    if (isContentClient(client) && this.#cacheKey && this.#indexedDB)
      return this.#syncContent(db, client, this.#cacheKey, force)
    return db.syncWith(client)
  }

  async #syncContent(
    db: LocalDB,
    client: ContentClient,
    cacheKey: string,
    force = false
  ): Promise<string> {
    this.#contentCache ??= new ContentCache(
      this.#indexedDB!,
      `alinea-content-${cacheKey}`
    )
    const cache = this.#contentCache
    const cached = await cache.getState()
    let state: ContentState | undefined
    try {
      state = await client.contentState(force ? undefined : cached?.revision)
    } catch (error) {
      if (force || !cached) throw error
      state = cached
    }
    state ??= cached
    if (!state) throw new Error('Content state was not available')
    if (this.#configId && state.configId !== this.#configId)
      throw new Error('Content state belongs to a different config release')
    if (db.sha === state.revision) return state.revision
    const hashes = Array.from(new Set(Object.values(state.entries)))
    const cachedObjects = await cache.getObjects(hashes)
    const validObjects: Record<string, ContentEntry> = {}
    const missing: Array<string> = []
    for (const hash of hashes) {
      const object = cachedObjects[hash]
      if (object && (await contentHash(object)) === hash)
        validObjects[hash] = object
      else missing.push(hash)
    }
    for (let offset = 0; offset < missing.length; offset += 250) {
      const batch = missing.slice(offset, offset + 250)
      const received = await client.contentEntries(batch)
      for (const hash of batch) {
        const object = received[hash]
        if (!object || (await contentHash(object)) !== hash)
          throw new Error(`Invalid content object: ${hash}`)
        validObjects[hash] = object
      }
    }
    const objects = Object.entries(state.entries).map(([id, hash]) => {
      const object = validObjects[hash]
      if (!object || object.id !== id)
        throw new Error(`Missing content entry: ${id}`)
      return object
    })
    await cache.put(state, validObjects)
    const revision = db.index.hydrate(state.revision, objects)
    this.dispatchEvent(new ContentStateEvent(state.policy))
    return revision
  }
}

interface ContentClient extends LocalConnection {
  contentState(revision?: string): Promise<ContentState | undefined>
  contentEntries(hashes: Array<string>): Promise<Record<string, ContentEntry>>
}

function isContentClient(client: LocalConnection): client is ContentClient {
  return (
    typeof client.contentState === 'function' &&
    typeof client.contentEntries === 'function'
  )
}

const contentEncoder = new TextEncoder()

function contentHash(value: unknown): Promise<string> {
  return hashBlob(contentEncoder.encode(JSON.stringify(value)))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface MutationTitleRow {
  id: string
  locale: string | null
  status: string
  title: string
}

async function summarizeMutations(
  db: LocalDB,
  mutations: Array<Mutation>
): Promise<Array<MutationQueueMutation>> {
  const targets = mutations.flatMap(mutation =>
    'id' in mutation && mutation.id ? [mutation.id] : []
  )
  const rows =
    targets.length > 0
      ? await db.find({
          select: {
            id: Entry.id,
            locale: Entry.locale,
            status: Entry.status,
            title: Entry.title
          },
          id: {in: targets},
          status: 'all'
        })
      : []
  return mutations.map(mutation =>
    mutationSummary(mutation, rows as Array<MutationTitleRow>)
  )
}

function mutationSummary(
  mutation: Mutation,
  rows: Array<MutationTitleRow>
): MutationQueueMutation {
  switch (mutation.op) {
    case 'create':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleFromData(mutation.data) ?? titleForMutation(mutation, rows),
        locale: mutation.locale,
        status: mutation.status
      }
    case 'update':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleFromData(mutation.set) ?? titleForMutation(mutation, rows),
        locale: mutation.locale,
        status: mutation.status
      }
    case 'remove':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleForMutation(mutation, rows),
        locale: mutation.locale,
        status: mutation.status
      }
    case 'publish':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleForMutation(mutation, rows),
        locale: mutation.locale,
        status: mutation.status
      }
    case 'unpublish':
    case 'archive':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleForMutation(mutation, rows),
        locale: mutation.locale
      }
    case 'move':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleForMutation(mutation, rows)
      }
    case 'uploadFile':
      return {
        op: mutation.op,
        target: mutation.location,
        title: fileTitle(mutation.location)
      }
    case 'removeFile':
      return {
        op: mutation.op,
        target: mutation.location,
        title: fileTitle(mutation.location)
      }
  }
}

function titleFromData(data: Record<string, unknown>): string | undefined {
  return typeof data.title === 'string' && data.title.trim()
    ? data.title.trim()
    : undefined
}

function titleForMutation(
  mutation: {id?: string; locale?: string | null; status?: string},
  rows: Array<MutationTitleRow>
): string | undefined {
  if (!mutation.id) return undefined
  const exact = rows.find(
    row =>
      row.id === mutation.id &&
      (!('locale' in mutation) || row.locale === mutation.locale) &&
      (!('status' in mutation) || row.status === mutation.status)
  )
  if (exact) return exact.title
  return rows.find(row => row.id === mutation.id)?.title
}

function fileTitle(location: string): string {
  return location.split('/').pop() || location
}
