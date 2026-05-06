import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {GraphQuery} from '#/core/Graph.js'
import {getScope} from '#/core/Scope.js'
import {trigger} from '#/core/Trigger.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Source} from '#/core/source/Source.js'
import pLimit from 'p-limit'
import {
  MutationQueueEvent,
  type MutationQueueEntry,
  type MutationQueueMutation
} from './MutationQueueEvent.js'

const remote = pLimit(1)

interface MutationQueueItem extends MutationQueueEntry {
  mutations: Array<Mutation>
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
  #blocked = false

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
    if (remote.activeCount > 0 || remote.pendingCount > 0) return db.sha
    const sync = remote(() => db.syncWith(client))
    if (db.index.tree.isEmpty) await sync
    return db.sha
  }

  async queue(id: string, mutations: Array<Mutation>): Promise<string> {
    const db = await this.db
    const item: MutationQueueItem = {
      id,
      mutations,
      status: this.#blocked ? 'blocked' : 'pending',
      attempt: 0
    }
    this.#queue.push(item)
    this.#emitQueue()
    if (this.#blocked) return db.sha
    try {
      await db.mutate(mutations)
      item.sha = db.sha
      this.#emitQueue()
      this.#flush(item)
      return item.sha
    } catch (error) {
      this.#blocked = true
      item.status = 'failed'
      item.error = errorMessage(error)
      this.#emitQueue()
      throw error
    }
  }

  async retryQueue(): Promise<void> {
    if (!this.#blocked) return
    const db = await this.db
    this.#blocked = false
    for (const item of this.#queue) {
      item.attempt += 1
      item.status = 'pending'
      item.error = undefined
      await db.mutate(item.mutations)
      item.sha = db.sha
    }
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
        this.#removeQueueItem(item)
        if (remote.pendingCount === 0 && sha !== item.sha)
          await db.syncWith(client)
      } catch (error) {
        this.#blocked = true
        item.status = 'failed'
        item.error = errorMessage(error)
        await db.syncWith(client)
        this.#emitQueue()
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
        this.#queue.map(({id, status, mutations, error}) => ({
          id,
          status,
          mutations: mutations.map(mutationSummary),
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

  async load(revision: string, config: Config, client: LocalConnection) {
    if (this.#currentRevision === revision) {
      await this.sync()
      return
    }
    this.#currentRevision = revision
    const db = new LocalDB(config, this.#source)
    try {
      if (this.#defer) this.#defer()
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
    } catch (error) {
      this.#nextLoad.reject(new Error('Failed to load database'))
    } finally {
      this.#nextLoad = trigger()
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function mutationSummary(mutation: Mutation): MutationQueueMutation {
  switch (mutation.op) {
    case 'create':
      return {
        op: mutation.op,
        target: mutation.id,
        locale: mutation.locale,
        status: mutation.status
      }
    case 'update':
    case 'remove':
      return {
        op: mutation.op,
        target: mutation.id,
        locale: mutation.locale,
        status: mutation.status
      }
    case 'publish':
      return {
        op: mutation.op,
        target: mutation.id,
        locale: mutation.locale,
        status: mutation.status
      }
    case 'unpublish':
    case 'archive':
      return {
        op: mutation.op,
        target: mutation.id,
        locale: mutation.locale
      }
    case 'move':
      return {
        op: mutation.op,
        target: mutation.id
      }
    case 'uploadFile':
      return {
        op: mutation.op,
        target: mutation.location
      }
    case 'removeFile':
      return {
        op: mutation.op,
        target: mutation.location
      }
  }
}
