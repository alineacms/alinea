import {Store} from 'alinea/backend/Store'
import {assign} from 'alinea/core/util/Objects'
import * as idb from 'lib0/indexeddb.js'
import {connect} from 'rado/driver/sql.js'

const STORAGE_NAME = '@alinea/peristent.store'

export interface PersistentStore extends Store {
  flush(): Promise<void>
}

export async function createPersistentStore(): Promise<PersistentStore> {
  const storagePromise = idb.openDB(STORAGE_NAME, db =>
    idb.createStores(db, [[STORAGE_NAME, {autoIncrement: true}]])
  )
  const sqlitePromise = import('@alinea/sqlite-wasm').then(
    ({default: sqlInit}) => sqlInit()
  )
  const [storage, {Database}] = await Promise.all([
    storagePromise,
    sqlitePromise
  ])
  // See if we have a blob available to initialize the database with
  const [store] = idb.transact(storage, [STORAGE_NAME], 'readonly')
  const buffer = await idb.get(store, 'db')
  const init = ArrayBuffer.isView(buffer) ? buffer : undefined
  const db = new Database(init)
  // Return an async connection so we can move the database to a worker later
  // without have to rewrite the dashboard
  return assign(connect(db).toAsync(), {
    async flush() {
      const [store] = idb.transact(storage, [STORAGE_NAME], 'readwrite')
      await idb.put(store, db.export(), 'db')
    }
  })
}
