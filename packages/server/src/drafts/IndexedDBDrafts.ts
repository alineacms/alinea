import * as idb from 'lib0/indexeddb.js'
import * as Y from 'yjs'
import {Drafts} from '../Drafts'

export type IndexedDBOptions = {}

const DB_NAME = '@alinea/server.drafts.idb'
const STORE_NAME = 'Draft'

export class IndexedDBDrafts implements Drafts {
  db: Promise<IDBDatabase>

  constructor(public options: IndexedDBOptions = {}) {
    this.db = idb.openDB(DB_NAME, db =>
      idb.createStores(db, [[STORE_NAME, {autoIncrement: true}]])
    )
  }

  async get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Uint8Array | undefined> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME], 'readonly')
    const draft = await idb.get(store, id)
    if (!(draft instanceof ArrayBuffer)) return undefined
    const update = new Uint8Array(draft)
    if (!stateVector) return update
    const doc = new Y.Doc()
    Y.applyUpdate(doc, update)
    return Y.encodeStateAsUpdate(doc, stateVector)
  }

  async update(id: string, update: Uint8Array): Promise<Drafts.Update> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME])
    const doc = new Y.Doc()
    const current = await this.get(id)
    if (current) Y.applyUpdate(doc, current)
    Y.applyUpdate(doc, update)
    const draft = Y.encodeStateAsUpdate(doc)
    idb.put(store, draft, id)
    return {id, update: draft}
  }

  async delete(ids: string[]): Promise<void> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME])
    for (const id of ids) await idb.del(store, id)
  }

  async *updates(): AsyncGenerator<Drafts.Update> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME])
    const ids: Array<string> = []
    await idb.iterateKeys(
      store,
      null,
      key => {
        ids.push(key)
      },
      'next'
    )
    for await (const id of ids) {
      yield {
        id,
        update: new Uint8Array((await idb.get(store, id)) as ArrayBuffer)
      }
    }
  }
}
