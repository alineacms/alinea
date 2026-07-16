import type {Config} from '#/core/Config.js'
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
import type {Source} from '#/core/source/Source.js'
import pLimit from 'p-limit'
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
}

export class DashboardWorker extends EventTarget {
  #source: Source
  #localDB: LocalDB | undefined
  #localClient: LocalConnection | undefined
  #nextLoad = trigger<{db: LocalDB; client: LocalConnection}>()
  #defer: Function | undefined
  #currentRevision: string | undefined
  #queue: Array<MutationQueueItem> = []
  #local = pLimit(1)
  #blocked = false
  #syncInterval: ReturnType<typeof setInterval> | undefined

  constructor(source: Source) {
    super()
    this.#source = source
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
    // The source is IndexedDB: if it has data, we can boot from cache.
    const sourceTree = await db.source.getTree()
    // The index is in-memory and starts empty for every fresh worker.
    if (db.index.tree.isEmpty && !sourceTree.isEmpty) await db.sync()
    // Always schedule a remote freshness check, but do not block boot if local
    // data was enough to build the index.
    const sync = remote(() => db.syncWith(client))
    if (sourceTree.isEmpty) await sync
    return db.sha
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
        await db.mutate(mutations)
        item.sha = db.sha
        this.#emitQueue()
        this.#flush(item)
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
      this.#blocked = false
      for (const item of this.#queue) {
        item.attempt += 1
        item.status = 'pending'
        item.error = undefined
        if (!item.sha) {
          try {
            await db.mutate(item.mutations)
            item.sha = db.sha
          } catch (error) {
            this.#blocked = true
            item.status = 'failed'
            item.error = errorMessage(error)
            this.#emitQueue()
            throw error
          }
        }
      }
    })
    this.#emitQueue()
    for (const item of this.#queue) this.#flush(item)
  }

  discardQueue(): void {
    this.#blocked = false
    for (const item of this.#queue) item.attempt += 1
    this.#queue = []
    this.#emitQueue()
  }

  #flush(item: MutationQueueItem) {
    const attempt = item.attempt
    void remote(async () => {
      if (item.attempt !== attempt) return
      if (this.#blocked) return
      if (item.status === 'failed') return
      item.status = 'syncing'
      this.#emitQueue()
      const client = await this.#client
      const db = await this.db
      try {
        const {sha} = await client.mutate(item.mutations)
        if (remote.pendingCount === 0 && sha !== item.sha)
          await db.syncWith(client)
        this.#removeQueueItem(item)
      } catch (error) {
        this.#blocked = true
        item.status = 'failed'
        item.error = errorMessage(error)
        this.#emitQueue()
        try {
          await db.syncWith(client)
          item.sha = undefined
        } catch {}
      }
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

  async load(revision: string, config: Config, client: LocalConnection) {
    if (this.#currentRevision === revision) {
      await this.sync()
      return
    }
    this.#currentRevision = revision
    const db = new LocalDB(config, this.#source)
    let recoverFromRemote = false
    try {
      if (this.#defer) this.#defer()
      await this.#syncLocalIndex(db).catch(
        // We end up syncing afterwards with remote anyway
        () => {
          recoverFromRemote = true
        }
      )
      this.#nextLoad.resolve({db, client})
      this.#localDB = db
      this.#localClient = client
      const listen = (event: Event) => {
        if (event instanceof IndexEvent)
          this.dispatchEvent(new IndexEvent(event.data))
      }
      db.index.addEventListener(IndexEvent.type, listen)
      this.#defer = () => {
        db.index.removeEventListener(IndexEvent.type, listen)
      }
    } catch (cause) {
      this.#nextLoad.reject(new Error('Failed to load database', {cause}))
      throw cause
    } finally {
      this.#nextLoad = trigger()
    }
    if (recoverFromRemote)
      await remote(() => db.syncWith(client)).catch(() => {})
    this.#startSyncing()
  }

  async #syncLocalIndex(db: LocalDB) {
    const sourceTree = await db.source.getTree()
    if (!sourceTree.isEmpty) await db.sync()
  }

  #startSyncing() {
    if (this.#syncInterval) return
    const sync = () => {
      void this.sync().catch(() => {})
    }
    sync()
    this.#syncInterval = setInterval(sync, syncInterval)
  }
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
