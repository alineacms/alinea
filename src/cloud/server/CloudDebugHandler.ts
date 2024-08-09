import {Database, Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {Drafts} from 'alinea/backend/Drafts'
import {History, Revision} from 'alinea/backend/History'
import {Pending} from 'alinea/backend/Pending'
import {GitHistory} from 'alinea/cli/serve/GitHistory'
import {Config} from 'alinea/core/Config'
import {Connection} from 'alinea/core/Connection'
import {Draft} from 'alinea/core/Draft'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {createId} from 'alinea/core/Id'
import {Mutation} from 'alinea/core/Mutation'
import simpleGit from 'simple-git'

const latency = 0

const lag = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class DebugCloud implements Media, Target, History, Drafts, Pending {
  drafts = new Map<string, Draft>()
  pending: Array<Connection.MutateParams & {toCommitHash: string}> = []
  history: History

  constructor(public config: Config, public db: Database, rootDir: string) {
    this.history = new GitHistory(simpleGit(rootDir), config, rootDir)
  }

  async mutate(params: Connection.MutateParams) {
    await lag(latency)
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

  async revisions(file: string): Promise<Array<Revision>> {
    await lag(latency)
    return this.history.revisions(file, undefined!)
  }

  async revisionData(file: string, revision: string): Promise<EntryRecord> {
    await lag(latency)
    return this.history.revisionData(file, revision, undefined!)
  }

  async getDraft(entryId: string): Promise<Draft | undefined> {
    await lag(latency)
    return this.drafts.get(entryId)
  }

  async storeDraft(draft: Draft): Promise<void> {
    await lag(latency)
    console.log(`> cloud: store draft ${draft.entryId}`)
    this.drafts.set(draft.entryId, draft)
  }

  async pendingSince(
    commitHash: string
  ): Promise<{toCommitHash: string; mutations: Array<Mutation>} | undefined> {
    await lag(latency)
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

export function createCloudDebugHandler(
  config: Config,
  db: Database,
  rootDir: string
) {
  const api = new DebugCloud(config, db, rootDir)
  return new Handler({
    db,
    config,
    target: api,
    media: api,
    history: api,
    drafts: api,
    pending: api,
    previews: new JWTPreviews(process.env.ALINEA_API_KEY ?? 'dev'),
    previewAuthToken: 'dev'
  })
}
