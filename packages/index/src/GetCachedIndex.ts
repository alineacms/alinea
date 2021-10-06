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

export async function getCachedIndex(dir: string, cache = cacheDir) {
  const name = path.basename(dir)
  console.log(`cache path: ${cache}`)
  console.log(`cwd: ${process.cwd()}`)
  console.log(fs.readdirSync(process.cwd()))
  console.log(fs.readdirSync(path.join(process.cwd(), '.next')))
  console.log(`exists: ${fs.existsSync(cache) ? 'yes' : 'no'}`)
  if (!fs.existsSync(cache)) fs.mkdirSync(cache, {recursive: true})
  const indexFile = path.join(cache, name)
  const exists = fs.existsSync(indexFile)
  const store = new SqliteStore(new BetterSqlite3(indexFile))
  if (exists) return store
  return createIndex(store, dir)
}
