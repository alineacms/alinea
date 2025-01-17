import sqlInit from '@alinea/sqlite-wasm'
import {Store} from 'alinea/backend/Store'
import * as idb from 'lib0/indexeddb.js'
import {connect} from 'rado/driver/sql.js'
import pkg from '../../../package.json'

const STORAGE_NAME = `@alinea/peristent.store`
const dbName = `db-${pkg.version}`

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

  // Cleanup older versions, delete all databases except the current one
  let store = idb.transact(storage, [STORAGE_NAME], 'readwrite')[0]
  const databases = await idb.getAllKeys(store)
  for (const name of databases) {
    if (name !== dbName) {
      await idb.del(store, name)
    }
  }

  // See if we have a blob available to initialize the database with
  store = idb.transact(storage, [STORAGE_NAME], 'readonly')[0]
  const buffer = await idb.get(store, dbName)
  const init =
    buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : undefined
  let db = new Database(init)

  /*const driverOptions =  {
    logQuery(stmt: {sql: string, params(): Array<unknown>}, duration: number) {
      if (!stmt.sql.startsWith('SELECT')) return
      if (duration < 10) return
      const icon = duration < 100 ? '⚡' : '⚠️'
      console.groupCollapsed(
        `${icon} Local query (${prettyMilliseconds(duration)})`
      )
      console.groupCollapsed('SQL')
      console.info(stmt.sql)
      console.groupEnd()
      console.groupCollapsed('Params')
      console.info(stmt.params())
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
  }*/

  // Return an async connection so we can move the database to a worker later
  // without have to rewrite the dashboard
  const persistent = {
    store: connect(db),
    async flush() {
      store = idb.transact(storage, [STORAGE_NAME], 'readwrite')[0]
      await idb.put(store, db.export() as any, dbName)
    },
    clone() {
      const clone = new Database(db.export())
      return connect(clone)
    },
    async clear() {
      store = idb.transact(storage, [STORAGE_NAME], 'readwrite')[0]
      await idb.del(store, dbName)
      db = new Database()
      persistent.store = connect(db)
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
    console.info(`${indent}${line.detail}`)
  }
}
