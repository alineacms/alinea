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

export async function getCachedIndex(dir: string, cacheFile?: string) {
  const name = path.basename(dir)
  const indexFile = path.resolve(cacheFile || path.join(cacheDir, name))
  const cacheLocation = path.dirname(indexFile)
  console.log(`cache path: ${indexFile}`)
  console.log(`cwd: ${process.cwd()}`)
  console.log(fs.readdirSync(process.cwd()))
  console.log(`exists: ${fs.existsSync(indexFile) ? 'yes' : 'no'}`)
  console.log(path.resolve(indexFile))
  if (!fs.existsSync(cacheLocation))
    fs.mkdirSync(cacheLocation, {recursive: true})
  const exists = fs.existsSync(indexFile)
  const store = new SqliteStore(
    new BetterSqlite3(indexFile, {
      readonly: exists
    })
  )
  if (exists) return store
  return createIndex(store, dir)
}
