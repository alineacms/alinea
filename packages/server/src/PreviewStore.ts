import {accumulate, Config} from '@alinea/core'
import {Store} from '@alinea/store'
import {Cache} from './Cache'
import {Drafts} from './Drafts'

type Cache = {lastFetched: number; store: Store}

const instances = new WeakMap<Drafts, PreviewStore>()

export function previewStore(
  createCache: () => Promise<Store>,
  config: Config,
  drafts: Drafts
) {
  if (instances.has(drafts)) return instances.get(drafts)!
  const instance = new PreviewStore(createCache, config, drafts)
  instances.set(drafts, instance)
  return instance
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

  constructor(
    private createCache: () => Promise<Store>,
    private config: Config,
    private drafts: Drafts
  ) {}

  async getStore() {
    if (this.lastFetchedAll && this.store) {
      const isExpired = isStale(this.lastFetchedAll, 60)
      if (!isExpired) return this.store
    }
    await this.fetchAllUpdates()
    await this.syncUpdates()
    return this.store!
  }

  private async fetchAllUpdates() {
    const updates: Map<string, Uint8Array> = new Map()
    for (const update of await accumulate(this.drafts.updates()))
      updates.set(update.id, update.update)
    this.updates = updates
    this.lastFetchedAll = Date.now()
  }

  async fetchUpdate(id: string) {
    const lastFetched = this.lastFetched.get(id)
    if (lastFetched && !isStale(lastFetched, 1)) return
    const update = await this.drafts.get(id)
    if (update) await this.applyUpdate({id, update})
  }

  async applyUpdate(update: Drafts.Update) {
    this.updates.set(update.id, update.update)
    return this.syncUpdates()
  }

  async deleteUpdate(id: string) {
    this.updates.delete(id)
    this.store = undefined
    return this.syncUpdates()
  }

  private async syncUpdates() {
    if (!this.store) this.store = await this.createCache()
    Cache.applyUpdates(this.store, this.config, this.updates.entries())
  }
}
