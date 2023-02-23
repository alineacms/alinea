import type {Drafts} from 'alinea/backend/Drafts'
import {Hub} from 'alinea/core/Hub'
import * as idb from 'lib0/indexeddb.js'
import * as Y from 'yjs'

export type IndexedDBDraftsOptions = {}

const DB_NAME = '@alinea/backend.drafts.idb'
const STORE_NAME = 'Draft'

export class IndexedDBDrafts implements Drafts {
  db: Promise<IDBDatabase>

  constructor(public options: IndexedDBDraftsOptions = {}) {
    this.db = idb.openDB(DB_NAME, db =>
      idb.createStores(db, [[STORE_NAME, {autoIncrement: true}]])
    )
  }

  async get({
    id,
    stateVector
  }: Hub.EntryParams): Promise<Uint8Array | undefined> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME], 'readonly')
    const draft = await idb.get(store, id)
    if (!(draft instanceof Uint8Array)) return undefined
    const update = new Uint8Array(draft)
    if (!stateVector) return update
    const doc = new Y.Doc()
    Y.applyUpdate(doc, update)
    return Y.encodeStateAsUpdate(doc, stateVector)
  }

  async update({id, update}: Hub.UpdateParams): Promise<Drafts.Update> {
    const db = await this.db
    const doc = new Y.Doc()
    const current = await this.get({id})
    if (current) Y.applyUpdate(doc, current)
    Y.applyUpdate(doc, update)
    const draft = Y.encodeStateAsUpdate(doc)
    const [store] = idb.transact(db, [STORE_NAME])
    await idb.put(store, draft, id)
    return {id, update: draft}
  }

  async delete({ids}: Hub.DeleteMultipleParams): Promise<void> {
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
        update: (await idb.get(store, id)) as Uint8Array
      }
    }
  }
}
