import {createIndex} from '@alinea/index'
import fs from 'fs'
import {BetterSqlite3} from 'helder.store/drivers/BetterSqlite3.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import {createRequire} from 'module'
import path from 'path'

const indexDir = import.meta.url
  ? createRequire(import.meta.url).resolve('@alinea/index')
  : __dirname
const cacheDir = path.join(path.dirname(indexDir), '../.cache')

export async function getCachedIndex(dir: string) {
  const name = path.basename(dir)
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, {recursive: true})
  const indexFile = path.join(cacheDir, name)
  const exists = fs.existsSync(indexFile)
  const store = new SqliteStore(new BetterSqlite3(indexFile))
  if (exists) return store
  return createIndex(store, dir)
}
