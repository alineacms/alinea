import {Config, Connection, Entry, accumulate} from 'alinea/core'
import {Store} from 'alinea/store'
import {Cache} from './Cache.js'
import {Drafts} from './Drafts.js'

type Cache = {lastFetched: number; store: Store}

export type PreviewStoreOptions = {
  name: string
  createCache: () => Promise<Store>
  config: Config
  drafts: Drafts
}

export function previewStore(options: PreviewStoreOptions) {
  return new PreviewStore(options)
}

function isStale(timestamp: number, maxAge: number) {
  const secondsAge = (Date.now() - timestamp) / 1000
  return secondsAge > maxAge
}

export class PreviewStore {
  store: Store | undefined
  lastFetchedAll: number | undefined
  lastFetched: Map<string, number> = new Map()
  updates: Map<string, Uint8Array> = new Map()

  constructor(public options: PreviewStoreOptions) {}

  async getStore(ctx: Connection.Context) {
    if (this.lastFetchedAll && this.store) {
      const isExpired = isStale(this.lastFetchedAll, 60)
      if (!isExpired) return this.store
    }
    await this.fetchAllUpdates(ctx)
    await this.syncUpdates()
    return this.store!
  }

  private async fetchAllUpdates(ctx: Connection.Context) {
    const end = ctx.logger.time('Fetch draft updates for preview store', true)
    const {drafts} = this.options
    const updates: Map<string, Uint8Array> = new Map()
    for (const update of await accumulate(drafts.updates({}, ctx)))
      updates.set(update.id, update.update)
    this.updates = updates
    this.lastFetchedAll = Date.now()
    end()
  }

  async fetchUpdate(id: string, ctx: Connection.Context) {
    const {drafts} = this.options
    const lastFetched = this.lastFetched.get(id)
    if (lastFetched && !isStale(lastFetched, 1)) {
      return
    }
    const end = ctx.logger.time('Fetch draft update', true)
    const update = await drafts.get({id}, ctx)
    if (update) {
      await this.applyUpdate({id, update})
    }
    end()
  }

  async applyUpdate(update: Drafts.Update) {
    this.updates.set(update.id, update.update)
    return this.syncUpdates()
  }

  async applyPublish(entries: Array<Entry>) {
    const {config} = this.options
    for (const entry of entries) this.updates.delete(entry.id)
    if (this.store) Cache.applyPublish(this.store, config, entries)
  }

  async deleteUpdate(id: string) {
    this.updates.delete(id)
    this.store = undefined
  }

  private async syncUpdates() {
    const {config, createCache} = this.options
    if (!this.store) {
      this.store = await createCache()
    }
    const updates = Array.from(this.updates.entries())
    Cache.applyUpdates(this.store, config, updates)
  }

  reload() {
    this.store = undefined
    return this.syncUpdates()
  }
}
