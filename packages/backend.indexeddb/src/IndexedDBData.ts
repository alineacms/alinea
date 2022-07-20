import type {Data} from '@alinea/backend/Data'
import {createId, Entry, Hub, slugify} from '@alinea/core'
import {basename, dirname, extname, join} from '@alinea/core/util/Paths'
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

  async upload({workspace, ...file}: Hub.UploadParams): Promise<string> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME])
    const dir = dirname(file.path)
    const extension = extname(file.path)
    const name = basename(file.path, extension)
    const fileName = `${slugify(name)}.${createId()}${extension}`
    const location = join(dir, fileName)
    await idb.put(store, file.buffer, 'file:' + location)
    return location
  }

  async download({
    workspace,
    location
  }: Hub.DownloadParams): Promise<Hub.Download> {
    const db = await this.db
    const [store] = idb.transact(db, [STORE_NAME], 'readonly')
    const buffer = await idb.get(store, 'file:' + location)
    return {type: 'buffer', buffer: buffer as ArrayBuffer}
  }
}
