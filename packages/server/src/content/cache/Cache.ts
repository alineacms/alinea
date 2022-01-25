import {createId, Entry, Schema} from '@alinea/core'
import {Store} from 'helder.store'
import {BetterSqlite3} from 'helder.store/sqlite/drivers/BetterSqlite3.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import {FS} from '../../backend/FS'
import {fillCache} from './FillCache'

function storeFromFile(file: string) {
  return new SqliteStore(new BetterSqlite3(file), createId)
}

export type CacheOptions = {
  schema: Schema
  dir: string
  fs: FS
}

export class Cache {
  private storePromise: Promise<Store> | undefined

  constructor(
    public schema: Schema,
    private open: () => Promise<Store>,
    public dir: string,
    protected fs: FS
  ) {}

  get store() {
    return this.storePromise || (this.storePromise = this.init(true))
  }

  private initStore(fill = true) {
    return this.storePromise || (this.storePromise = this.init(fill))
  }

  private async init(fill: boolean) {
    const store = await this.open()
    if (fill && this.dir) {
      const hasEntries = Boolean(store.first(Entry))
      if (!hasEntries) await fillCache(this.fs, this.schema, store, this.dir)
    }
    return store
  }

  async sync() {
    if (!this.dir) throw new Error(`This cache is readonly`)
    const store = await this.initStore(false)
    return fillCache(this.fs, this.schema, store, this.dir)
  }

  static fromPromise(schema: Schema, store: Promise<Store>, fs: FS) {
    return new Cache(schema, () => store, undefined!, fs)
  }

  static fromMemory({schema, dir, fs}: CacheOptions) {
    return new Cache(
      schema,
      async () => {
        return new SqliteStore(new BetterSqlite3(), createId)
      },
      dir,
      fs
    )
  }
}
