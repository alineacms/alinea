import {createIndex} from '@alinea/index'
import {constants} from 'fs'
import fs from 'fs-extra'
import {BetterSqlite3} from 'helder.store/drivers/BetterSqlite3.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import {createRequire} from 'module'
import os from 'os'
import path from 'path'

const indexDir = import.meta.url
  ? createRequire(import.meta.url).resolve('@alinea/index')
  : __dirname
const cacheDir = path.join(path.dirname(indexDir), '../.cache')

export async function getCachedIndex(dir: string, cacheFile?: string) {
  const name = path.basename(dir)
  let indexFile = path.resolve(cacheFile || path.join(cacheDir, name))
  const cacheLocation = path.dirname(indexFile)
  await fs.mkdir(cacheLocation, {recursive: true})
  console.log(`cache path: ${indexFile}`)
  console.log(`cwd: ${process.cwd()}`)
  try {
    const stat = await fs.stat(indexFile)
    console.log(`size: ${stat.size}`)
    console.log(path.resolve(indexFile))
    try {
      await fs.access(indexFile, constants.W_OK)
    } catch (e) {
      console.log('not writeable')
      const tmpFile = path.join(os.tmpdir(), name)
      try {
        const stat = await fs.stat(tmpFile)
        console.log(stat)
      } catch (e) {
        console.log('copy to tmp')
        try {
          await fs.copyFile(indexFile, tmpFile)
          console.log('copied to tmp')
        } catch (e) {
          console.log(`could not copy because ${e}`)
        }
      }
      indexFile = tmpFile
    }
  } catch (e) {
    console.log(`cannot stat, because ${e}`)
  }
  const exists = fs.existsSync(indexFile)
  console.log(`exists ${exists}`)
  const store = new SqliteStore(
    new BetterSqlite3(indexFile, {
      readonly: exists
    })
  )
  if (exists) return store
  return createIndex(store, dir)
}
