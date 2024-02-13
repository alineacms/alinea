import {Config} from 'alinea/core/Config'
import {Connection} from 'alinea/core/Connection'
import {Draft} from 'alinea/core/Draft'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {createId} from 'alinea/core/Id'
import {Mutation} from 'alinea/core/Mutation'
import {Database} from '../Database.js'
import {Drafts} from '../Drafts.js'
import {Handler} from '../Handler.js'
import {History, Revision} from '../History.js'
import {Media} from '../Media.js'
import {Pending} from '../Pending.js'
import {Target} from '../Target.js'
import {JWTPreviews} from '../util/JWTPreviews.js'

class MemoryApi implements Media, Target, History, Drafts, Pending {
  drafts = new Map<string, Draft>()
  pending: Array<Connection.MutateParams & {toCommitHash: string}> = []

  constructor(public config: Config, public db: Database) {}

  async mutate(params: Connection.MutateParams) {
    const mutations = params.mutations.flatMap(mutate => mutate.meta)
    const toCommitHash = createId()
    await this.db.applyMutations(mutations, toCommitHash)
    this.pending.push({...params, toCommitHash})
    return {commitHash: toCommitHash}
  }

  prepareUpload(file: string): Promise<Connection.UploadResponse> {
    throw new Error(`Uploads are not available`)
  }

  async revisions(file: string): Promise<Array<Revision>> {
    return []
  }

  async revisionData(file: string, revision: string): Promise<EntryRecord> {
    throw new Error(`Revisions are not available`)
  }

  async getDraft(entryId: string): Promise<Draft | undefined> {
    return this.drafts.get(entryId)
  }

  async storeDraft(draft: Draft): Promise<void> {
    this.drafts.set(draft.entryId, draft)
  }

  async pendingSince(
    commitHash: string
  ): Promise<{toCommitHash: string; mutations: Array<Mutation>} | undefined> {
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

export function createMemoryHandler(config: Config, db: Database) {
  const api = new MemoryApi(config, db)
  return new Handler({
    db,
    config,
    target: api,
    media: api,
    history: api,
    drafts: api,
    pending: api,
    previews: new JWTPreviews('dev'),
    previewAuthToken: 'dev'
  })
}
