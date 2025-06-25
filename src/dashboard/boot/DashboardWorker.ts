import type {Config} from 'alinea/core/Config'
import type {LocalConnection} from 'alinea/core/Connection'
import {IndexEvent} from 'alinea/core/db/IndexEvent'
import {LocalDB} from 'alinea/core/db/LocalDB'
import type {Mutation} from 'alinea/core/db/Mutation'
import type {GraphQuery} from 'alinea/core/Graph'
import {getScope} from 'alinea/core/Scope'
import type {Source} from 'alinea/core/source/Source'
import {trigger} from 'alinea/core/Trigger'
import pLimit from 'p-limit'

export class MutateEvent extends Event {
  static readonly type = 'mutate'
  constructor(
    public id: string,
    public status: 'success' | 'failure',
    public error?: Error
  ) {
    super(MutateEvent.type)
  }
}

const local = pLimit(1)
const remote = pLimit(1)

export class DashboardWorker extends EventTarget {
  #source: Source
  #localDB: LocalDB | undefined
  #localClient: LocalConnection | undefined
  #nextLoad = trigger<{db: LocalDB; client: LocalConnection}>()
  #defer: Function | undefined
  #currentRevision: string | undefined

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
    if (remote.pendingCount > 0) return db.sha
    const sync = remote(() => db.syncWith(client))
    if (db.index.tree.isEmpty) await sync
    return db.sha
  }

  async #apply(mutations: Array<Mutation>) {
    const db = await this.db
    await local(() => db.mutate(mutations))
    return db.sha
  }

  async queue(id: string, mutations: Array<Mutation>): Promise<string> {
    await this.#apply(mutations)
    return remote(async () => {
      const client = await this.#client
      return client.mutate(mutations).then(async () => {
        ;(await this.db).logEntries()
        return this.sync()
      })
    })
  }

  async resolve(raw: string): Promise<unknown> {
    const db = await this.db
    const scope = getScope(db.config)
    const query = scope.parse(raw) as GraphQuery
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
