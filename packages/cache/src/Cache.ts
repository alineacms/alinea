import {createId, Entry, outcome, Schema} from '@alinea/core'
import {constants} from 'fs'
import fs from 'fs-extra'
import {Store} from 'helder.store'
import {BetterSqlite3} from 'helder.store/sqlite/drivers/BetterSqlite3.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import {createRequire} from 'module'
import os from 'os'
import path from 'path'
import {fillCache} from './FillCache'

function getLocalCacheFile() {
  const indexDir = import.meta.url
    ? createRequire(import.meta.url).resolve('@alinea/cache')
    : __dirname
  return path.join(path.dirname(indexDir), '../.cache')
}

function storeFromFile(file: string) {
  return new SqliteStore(new BetterSqlite3(file), createId)
}

export type CacheOptions = {
  schema: Schema
  dir: string
}

export class Cache {
  private storePromise: Promise<Store> | undefined

  constructor(
    public schema: Schema,
    public dir: string,
    private open: () => Promise<Store>
  ) {}

  get store() {
    return this.storePromise || (this.storePromise = this.init(true))
  }

  private initStore(fill = true) {
    return this.storePromise || (this.storePromise = this.init(fill))
  }

  private async init(fill: boolean) {
    const store = await this.open()
    if (fill) {
      const hasEntries = Boolean(store.first(Entry))
      if (!hasEntries) await fillCache(this.schema, store, this.dir)
    }
    return store
  }

  async sync() {
    const store = await this.initStore(false)
    return fillCache(this.schema, store, this.dir)
  }

  static fromMemory({schema, dir}: CacheOptions) {
    return new Cache(schema, dir, async () => {
      return new SqliteStore(new BetterSqlite3(), createId)
    })
  }

  static fromFile({
    schema,
    dir,
    cacheFile = getLocalCacheFile()
  }: CacheOptions & {cacheFile: string}) {
    return new Cache(schema, dir, async () => {
      const name = path.basename(cacheFile)
      let indexFile = path.resolve(cacheFile)
      const cacheLocation = path.dirname(indexFile)
      await fs.mkdir(cacheLocation, {recursive: true})
      const exists = await outcome.succeeds(fs.stat(indexFile))
      if (exists) {
        const writeable = await outcome.succeeds(
          fs.access(indexFile, constants.W_OK)
        )
        if (!writeable) {
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
