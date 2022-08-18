import type {Data} from '@alinea/backend/Data'
import {Entry, Hub} from '@alinea/core'
import * as idb from 'lib0/indexeddb.js'

export type IndexedDBOptions = {}

const DB_NAME = '@alinea/backend.data.idb'
const STORE_NAME = 'Data'

export class IndexedDBData implements Data.Source, Data.Target, Data.Media {
  canRename = false
  db: Promise<IDBDatabase>

  constructor(public options: IndexedDBOptions = {}) {
    this.db = idb.openDB(DB_NAME, db =>
      idb.createStores(db, [[STORE_NAME, {autoIncrement: true}]])
    )
  }

  async *entries(): AsyncGenerator<Entry> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME])
    const keys: Array<string> = []
    await idb.iterateKeys(
      store,
      null,
      key => {
        if (key.startsWith('entry:')) keys.push(key)
      },
      'next'
    )
    for (const key of keys) {
      const data = await idb.get(store, key)
      if (typeof data === 'string') yield JSON.parse(data)
    }
  }

  async publish({changes}: Hub.ChangesParams, ctx: Hub.Context) {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME])
    for (const {id, contents} of changes.write)
      await idb.put(store, contents, 'entry:' + id)
    for (const {id} of changes.delete) await idb.del(store, 'entry:' + id)
  }

  async upload({fileLocation, buffer}: Hub.MediaUploadParams): Promise<string> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME])
    await idb.put(store, buffer, 'file:' + fileLocation)
    return fileLocation
  }

  async download({location}: Hub.DownloadParams): Promise<Hub.Download> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME], 'readonly')
    const buffer = await idb.get(store, 'file:' + location)
    return {type: 'buffer', buffer: buffer as ArrayBuffer}
  }
}
