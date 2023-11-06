import sqlInit from '@alinea/sqlite-wasm'
import {Store} from 'alinea/backend/Store'
import * as idb from 'lib0/indexeddb.js'
import prettyMilliseconds from 'pretty-ms'
import {DriverOptions} from 'rado'
import {connect} from 'rado/driver/sql.js'

const STORAGE_NAME = '@alinea/peristent.store'

export interface PersistentStore {
  store: Store
  flush(): Promise<void>
  clone(): Store
  clear(): Promise<void>
}

export async function createPersistentStore(): Promise<PersistentStore> {
  const storagePromise = idb.openDB(STORAGE_NAME, db =>
    idb.createStores(db, [[STORAGE_NAME, {autoIncrement: true}]])
  )
  const sqlitePromise = sqlInit()
  const [storage, {Database}] = await Promise.all([
    storagePromise,
    sqlitePromise
  ])
  // See if we have a blob available to initialize the database with
  const [store] = idb.transact(storage, [STORAGE_NAME], 'readonly')
  const buffer = await idb.get(store, 'db')
  const init = ArrayBuffer.isView(buffer) ? buffer : undefined
  let db = new Database(init)
  const driverOptions: DriverOptions = {
    logQuery(stmt, duration) {
      if (!stmt.sql.startsWith('SELECT')) return
      if (duration < 10) return
      const icon = duration < 100 ? '⚡' : '⚠️'
      console.groupCollapsed(
        `${icon} Local query (${prettyMilliseconds(duration)})`
      )
      console.groupCollapsed('SQL')
      console.log(stmt.sql)
      console.groupEnd()
      console.groupCollapsed('Params')
      console.log(stmt.params())
      console.groupEnd()
      console.groupCollapsed('Query plan')
      const explain = db.prepare(
        `explain query plan ${stmt.sql}`,
        stmt.params()
      )
      const plan: Array<QueryPlanItem> = []
      while (explain.step()) plan.push(explain.getAsObject() as any)
      explain.free()
      renderQueryPlan(plan)
      console.groupEnd()
      console.groupEnd()
    }
  }
  // Return an async connection so we can move the database to a worker later
  // without have to rewrite the dashboard
  const persistent = {
    store: connect(db, driverOptions).toAsync(),
    async flush() {
      const [store] = idb.transact(storage, [STORAGE_NAME], 'readwrite')
      await idb.put(store, db.export(), 'db')
    },
    clone() {
      const clone = new Database(db.export())
      return connect(clone, driverOptions).toAsync()
    },
    async clear() {
      const [store] = idb.transact(storage, [STORAGE_NAME], 'readwrite')
      await idb.del(store, 'db')
      db = new Database()
      this.store = connect(db, driverOptions).toAsync()
    }
  }
  return persistent
}

interface QueryPlanItem {
  id: number
  parent: number
  detail: string
}

function renderQueryPlan(plan: Array<QueryPlanItem>) {
  const depth = new Map<number, number>()
  for (const line of plan) {
    const parentDepth = depth.get(line.parent) || 0
    depth.set(line.id, parentDepth + 1)
    const indent = ' '.repeat(parentDepth * 2)
    console.log(`${indent}${line.detail}`)
  }
}
