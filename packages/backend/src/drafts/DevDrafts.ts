import {Hub} from '@alinea/core/Hub'
import {Collection} from '@alinea/store/Collection'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import path from 'node:path'
import * as Y from 'yjs'
import {Drafts} from '../Drafts'
import {exportStore} from '../export/ExportStore'

export type DevDraftsOptions = {
  outDir: string
  createStore: () => Promise<SqliteStore>
}

type Draft = {id: string; draft: string}
const Draft = new Collection<Draft>('Draft')

const FILENAME = 'drafts.js'

export class DevDrafts implements Drafts {
  location: string
  store: Promise<SqliteStore>

  constructor(protected options: DevDraftsOptions) {
    this.location = path.join(this.options.outDir, FILENAME)
    this.store = options.createStore()
  }

  private async write() {
    const store = await this.store
    await exportStore(store, this.location)
  }

  async get({
    id,
    stateVector
  }: Hub.EntryParams): Promise<Uint8Array | undefined> {
    const store = await this.store
    const draft = store.first(Draft.where(Draft.id.is(id)))
    if (!draft) return undefined
    return Buffer.from(draft.draft, 'base64')
  }

  async update({id, update}: Hub.UpdateParams): Promise<Drafts.Update> {
    const store = await this.store
    const doc = new Y.Doc()
    const current = await this.get({id})
    if (current) Y.applyUpdate(doc, current)
    Y.applyUpdate(doc, update)
    const draft = Buffer.from(Y.encodeStateAsUpdate(doc))
    if (current)
      store.update(Draft.where(Draft.id.is(id)), {
        draft: draft.toString('base64')
      })
    else store.insert(Draft, {id, draft: draft.toString('base64')})
    await this.write()
    return {id, update: draft}
  }

  async delete({ids}: Hub.DeleteMultipleParams): Promise<void> {
    const store = await this.store
    store.delete(Draft.where(Draft.id.isIn(ids)))
    await this.write()
  }

  async *updates(): AsyncGenerator<{id: string; update: Uint8Array}> {
    const store = await this.store
    const drafts = store.all(Draft)
    for (const draft of drafts) {
      yield {id: draft.id, update: Buffer.from(draft.draft, 'base64')}
    }
  }
}
