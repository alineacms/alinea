import {createId} from 'alinea/core/Id'
import {SqlJsDriver} from 'alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from 'alinea/store/sqlite/SqliteStore'

export async function createDb(
  data?: Uint8Array | SqliteStore
): Promise<SqliteStore> {
  /*try {
    const {default: Database} = await import('better-sqlite3')
    return new SqliteStore(
      new BetterSqlite3Driver(new Database(':memory:')),
      createId
    )
  } catch (e) {*/
  const {default: sqlInit} = await import('@alinea/sqlite-wasm')
  const {Database} = await sqlInit()
  if (data instanceof SqliteStore) {
    return Object.assign(data, {db: new SqlJsDriver(new Database())})
  }
  return new SqliteStore(new SqlJsDriver(new Database(data)), createId)
  /*}*/
}
