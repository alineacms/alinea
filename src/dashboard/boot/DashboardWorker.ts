import type {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import type {GraphQuery} from 'alinea/core/Graph'
import {getScope} from 'alinea/core/Scope'
import {trigger} from 'alinea/core/Trigger'
import {EntryUpdate, IndexUpdate} from 'alinea/core/db/IndexEvent'
import {LocalDB} from 'alinea/core/db/LocalDB'
import type {Mutation} from 'alinea/core/db/Mutation'
import type {Source} from 'alinea/core/source/Source'
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

export class DashboardWorker {
  #ports = new Set<MessagePort>()
  #source: Source
  #localDB: LocalDB | undefined
  #localClient: Client | undefined
  #nextLoad = trigger<{db: LocalDB; client: Client}>()
  #defer: Function | undefined
  #currentRevision: string | undefined
  #lastWrite: Promise<unknown> | undefined

  constructor(source: Source) {
    this.#source = source
  }

  add(port: MessagePort) {
    this.#ports.add(port)
    return this
  }

  get #db() {
    return this.#localDB ?? this.#nextLoad.then(res => res.db)
  }

  get #client() {
    return this.#localClient ?? this.#nextLoad.then(res => res.client)
  }

  async sync() {
    const db = await this.#db
    const client = await this.#client
    if (remote.pendingCount > 0) return db.sha
    console.log('sync')
    return remote(() => db.syncWith(client))
  }

  async #apply(mutations: Array<Mutation>) {
    const db = await this.#db
    await local(() => db.mutate(mutations))
    return db.sha
  }

  async queue(id: string, mutations: Array<Mutation>): Promise<string> {
    console.log({id, mutations})
    const sha = await this.#apply(mutations)
    remote(async () => {
      const client = await this.#client
      return client
        .mutate(mutations)
        .then(() => {
          this.#dispatch(new MutateEvent(id, 'success'))
        })
        .catch(error => {
          console.error(error)
          this.#dispatch(new MutateEvent(id, 'failure', error))
        })
        .finally(() => {
          this.sync()
        })
    })
    return sha
  }

  #dispatch(event: Event) {
    for (const port of this.#ports) {
      try {
        port.postMessage({...event, type: event.type})
      } catch {
        this.#ports.delete(port)
      }
    }
  }

  async resolve(raw: string): Promise<unknown> {
    const db = await this.#db
    const scope = getScope(db.config)
    const query = scope.parse(raw) as GraphQuery
    return db.resolve(query)
  }

  async load(revision: string, config: Config, client: Client) {
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
      const listen = (event: Event) => this.#dispatch(event)
      db.index.addEventListener(IndexUpdate.type, listen)
      db.index.addEventListener(EntryUpdate.type, listen)
      this.#defer = () => {
        db.index.removeEventListener(IndexUpdate.type, listen)
        db.index.removeEventListener(EntryUpdate.type, listen)
      }
    } catch (error) {
      this.#nextLoad.reject(new Error('Failed to load database'))
    } finally {
      this.#nextLoad = trigger()
    }
  }
}
