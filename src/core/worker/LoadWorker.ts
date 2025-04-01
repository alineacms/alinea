import type {CMS} from 'alinea/core/CMS'
import {Client} from 'alinea/core/Client'
import type {GraphQuery} from 'alinea/core/Graph'
import {getScope} from 'alinea/core/Scope'
import {trigger} from 'alinea/core/Trigger'
import {EntryUpdate, IndexUpdate} from 'alinea/core/db/IndexEvent'
import type {Mutation} from 'alinea/core/db/Mutation'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource'
import type {Source} from 'alinea/core/source/Source'
import * as Comlink from 'comlink'
import pLimit from 'p-limit'
import {LocalDB} from '../db/LocalDB.js'

type ConfigLoader = (revision: string) => Promise<{cms: CMS}>

interface Batch {
  id: string
  mutations: Array<Mutation>
}

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
  #loadConfig: ConfigLoader
  #localDB: LocalDB | undefined
  #localClient: Client | undefined
  #nextLoad = trigger<{db: LocalDB; client: Client}>()
  #defer: Function | undefined
  #currentRevision: string | undefined
  #lastWrite: Promise<unknown> | undefined

  constructor(source: Source, loadConfig: ConfigLoader) {
    this.#source = source
    this.#loadConfig = loadConfig
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
          // this.#dispatch(new MutateEvent(id, 'failure', error))
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

  async load(handlerUrl: string, revision: string) {
    if (this.#currentRevision === revision) return
    this.#currentRevision = revision
    const {cms} = await this.#loadConfig(revision)
    const client = new Client({config: cms.config, url: handlerUrl})
    const db = new LocalDB(cms.config, this.#source)
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

export async function loadWorker(
  loadConfig: (revision: string) => Promise<{cms: CMS}>
) {
  const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
  const worker = new DashboardWorker(source, loadConfig)
  globalThis.onconnect = event => {
    console.log('Worker connected')
    const port = event.ports[0]
    Comlink.expose(worker.add(port), port)
  }
}
