import {Database, Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {Drafts} from 'alinea/backend/Drafts'
import {History, Revision} from 'alinea/backend/History'
import {Pending} from 'alinea/backend/Pending'
import {Config, Connection, Draft, createId} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Mutation} from 'alinea/core/Mutation'

export class DebugCloud implements Media, Target, History, Drafts, Pending {
  drafts = new Map<string, Draft>()
  pending: Array<Connection.MutateParams & {toCommitHash: string}> = []

  constructor(public config: Config, public db: Database) {}

  async mutate(params: Connection.MutateParams) {
    const mutations = params.mutations.flatMap(mutate => mutate.meta)
    for (const mutation of params.mutations) {
      console.log(
        `> cloud: mutate ${mutation.meta.type} - ${mutation.meta.entryId}`
      )
    }
    const toCommitHash = createId()
    await this.db.applyMutations(mutations, toCommitHash)
    this.pending.push({...params, toCommitHash})
    console.log(`> cloud: current ${toCommitHash}`)
    return {commitHash: toCommitHash}
  }

  prepareUpload(file: string): Promise<Connection.UploadResponse> {
    throw new Error(`Not implemented`)
  }

  async deleteUpload({
    location,
    workspace
  }: Connection.DeleteParams): Promise<void> {
    console.log(`> cloud: delete`, location, workspace)
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
    console.log(`> cloud: store draft ${draft.entryId}`)
    this.drafts.set(draft.entryId, draft)
  }

  async pendingSince(
    commitHash: string
  ): Promise<{toCommitHash: string; mutations: Array<Mutation>} | undefined> {
    console.log(`> cloud: pending since ${commitHash}`)
    let i = this.pending.length
    for (; i >= 0; i--)
      if (i > 0 && this.pending[i - 1].toCommitHash === commitHash) break
    const pending = this.pending.slice(i)
    if (pending.length === 0) return undefined
    return {
      toCommitHash: pending[pending.length - 1].toCommitHash,
      mutations: pending.flatMap(params =>
        params.mutations.flatMap(mutate => mutate.meta)
      )
    }
  }
}

export function createCloudDebugHandler(config: Config, db: Database) {
  const api = new DebugCloud(config, db)
  return new Handler({
    db,
    config,
    target: api,
    media: api,
    history: api,
    drafts: api,
    pending: api,
    previews: new JWTPreviews('dev')
  })
}
