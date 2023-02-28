import {Drafts} from 'alinea/backend/Drafts'
import {Hub} from 'alinea/core/Hub'
import {base64} from 'alinea/core/util/Encoding'
import {Collection} from 'alinea/store/Collection'
import {SqliteStore} from 'alinea/store/sqlite/SqliteStore'

export type DevDraftsOptions = {
  createStore: () => Promise<SqliteStore>
}

type Draft = {id: string; draft: string}
const Draft = new Collection<Draft>('Draft')

export class DevDrafts implements Drafts {
  store: Promise<SqliteStore>

  constructor(protected options: DevDraftsOptions) {
    this.store = options.createStore()
  }

  async get({
    id,
    stateVector
  }: Hub.EntryParams): Promise<Uint8Array | undefined> {
    const store = await this.store
    const draft = store.first(Draft.where(Draft.id.is(id)))
    if (!draft) return undefined
    return base64.parse(draft.draft)
  }

  async update(params: Hub.UpdateParams): Promise<Drafts.Update> {
    return params
  }

  async delete({ids}: Hub.DeleteMultipleParams): Promise<void> {}

  async *updates(): AsyncGenerator<{id: string; update: Uint8Array}> {
    const store = await this.store
    const drafts = store.all(Draft)
    for (const draft of drafts) {
      yield {id: draft.id, update: base64.parse(draft.draft)}
    }
  }
}
