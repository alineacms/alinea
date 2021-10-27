import {createId} from '@alinea/core/Id'
import {Outcome} from '@alinea/core/Outcome'
import {createIndex} from '@alinea/index'
import {constants} from 'fs'
import fs from 'fs-extra'
import {Store} from 'helder.store'
import {BetterSqlite3} from 'helder.store/sqlite/drivers/BetterSqlite3.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import {createRequire} from 'module'
import os from 'os'
import path from 'path'

function getLocalCacheFile() {
  const indexDir = import.meta.url
    ? createRequire(import.meta.url).resolve('@alinea/index')
    : __dirname
  return path.join(path.dirname(indexDir), '../.cache')
}

function storeFromFile(file: string) {
  return new SqliteStore(new BetterSqlite3(file), createId)
}

export class ContentIndex {
  private storePromise: Promise<Store> | undefined

  constructor(private open: () => Promise<Store>) {}

  get store() {
    return this.storePromise || (this.storePromise = this.open())
  }

  async indexDirectory(dir: string) {
    await createIndex(await this.store, dir)
    return this
  }

  static fromMemory() {
    return new ContentIndex(async () => {
      return new SqliteStore(new BetterSqlite3(), createId)
    })
  }

  static fromCacheFile(cacheFile: string = getLocalCacheFile()) {
    return new ContentIndex(async () => {
      const name = path.basename(cacheFile)
      let indexFile = path.resolve(cacheFile)
      const cacheLocation = path.dirname(indexFile)
      await fs.mkdir(cacheLocation, {recursive: true})
      const stats = await Outcome.promised(() => fs.stat(indexFile))
      if (stats.isSuccess()) {
        const writeable = await Outcome.promised(() =>
          fs.access(indexFile, constants.W_OK)
        )
        if (writeable.isFailure()) {
          // We have an existing index file, but it is not writeable.
          // This can happen in serverless environments.
          // Copy the index to a temporary file so we can read/write.
          const tmpFile = path.join(os.tmpdir(), name)
          await fs.copyFile(indexFile, tmpFile)
          return storeFromFile(tmpFile)
        }
      }
      return storeFromFile(indexFile)
    })
  }
}
