import {Database, Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {Drafts} from 'alinea/backend/Drafts'
import {History, Revision} from 'alinea/backend/History'
import {Pending} from 'alinea/backend/Pending'
import {Store} from 'alinea/backend/Store'
import {Config, Connection, Draft} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Mutation} from 'alinea/core/Mutation'

export class DebugCloud implements Media, Target, History, Drafts, Pending {
  db: Database
  drafts = new Map<string, Draft>()
  pending: Array<Connection.MutateParams> = []

  constructor(public config: Config, public store: Store) {
    this.db = new Database(config, store)
  }

  async mutate(params: Connection.MutateParams) {
    const mutations = params.mutations.flatMap(mutate => mutate.meta)
    console.log('mutate', mutations)
    await this.db.applyMutations(mutations)
    this.pending.push(params)
  }

  prepareUpload(file: string): Promise<Connection.UploadResponse> {
    throw new Error(`Not implemented`)
  }

  async deleteUpload({
    location,
    workspace
  }: Connection.DeleteParams): Promise<void> {
    console.log(`delete`, location, workspace)
  }

  async revisions(file: string): Promise<Array<Revision>> {
    return []
  }

  async revisionData(file: string, revision: string): Promise<EntryRecord> {
    throw new Error(`Not implemented`)
  }

  async getDraft(entryId: string): Promise<Draft | undefined> {
    return this.drafts.get(entryId)
  }

  async storeDraft(draft: Draft): Promise<void> {
    this.drafts.set(draft.entryId, draft)
  }

  async pendingSince(contentHash: string): Promise<Array<Mutation>> {
    let i = this.pending.length
    for (; i >= 0; i--)
      if (i > 0 && this.pending[i - 1].contentHash.from === contentHash) break
    return this.pending
      .slice(i)
      .flatMap(params => params.mutations.flatMap(mutate => mutate.meta))
  }
}

export function createCloudDebugHandler(config: Config, store: Store) {
  const api = new DebugCloud(config, store)
  return new Handler({
    store,
    config,
    target: api,
    media: api,
    history: api,
    drafts: api,
    pending: api,
    previews: new JWTPreviews('dev')
  })
}
