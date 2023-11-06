import {Config, Connection, Draft, SyncResponse} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Graph} from 'alinea/core/Graph'
import {EditMutation, Mutation, MutationType} from 'alinea/core/Mutation'
import {base64} from 'alinea/core/util/Encoding'
import {mergeUpdatesV2} from 'yjs'
import {Database} from './Database.js'
import {Drafts} from './Drafts.js'
import {History, Revision} from './History.js'
import {Media} from './Media.js'
import {Pending} from './Pending.js'
import {Previews} from './Previews'
import {ResolveDefaults, Resolver} from './Resolver.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSetCreator} from './data/ChangeSet.js'

export interface PreviewOptions {
  preview?: boolean
  previewToken?: string
}

export type ServerOptions = {
  config: Config
  store: Store
  previews: Previews
  target?: Target
  media?: Media
  drafts?: Drafts
  history?: History
  pending?: Pending
  resolveDefaults?: ResolveDefaults
}

export class Server implements Connection {
  db: Database
  resolver: Resolver
  protected graph: Graph
  changes: ChangeSetCreator

  constructor(
    public options: ServerOptions,
    public context: Connection.Context
  ) {
    this.db = new Database(options.config, options.store)
    this.resolver = new Resolver(options.store, options.config.schema)
    this.graph = new Graph(this.options.config, this.resolve)
    this.changes = new ChangeSetCreator(options.config)
  }

  // Api

  resolve = (params: Connection.ResolveParams) => {
    const {resolveDefaults} = this.options
    return this.resolver.resolve({...resolveDefaults, ...params})
  }

  // Target

  async mutate(mutations: Array<Mutation>): Promise<void> {
    const {target, media} = this.options
    if (!target) throw new Error('Target not available')
    if (!media) throw new Error('Media not available')
    const changes = this.changes.create(mutations)
    await this.syncPending()
    const {contentHash} = await this.db.applyMutations(mutations)
    await target.mutate({contentHash, mutations: changes}, this.context)
    const tasks = []
    for (const mutation of mutations) {
      switch (mutation.type) {
        case MutationType.FileRemove:
          tasks.push(
            media.delete(
              {location: mutation.location, workspace: mutation.workspace},
              this.context
            )
          )
          continue
        case MutationType.Edit:
          tasks.push(this.persistEdit(mutation))
          continue
      }
    }
    await Promise.all(tasks)
  }

  previewToken(): Promise<string> {
    const {previews} = this.options
    const user = this.context.user
    if (!user) return previews.sign({anonymous: true})
    return previews.sign({sub: user.sub})
  }

  // Media

  prepareUpload(file: string): Promise<Connection.UploadResponse> {
    const {media} = this.options
    if (!media) throw new Error('Media not available')
    return media.prepareUpload(file, this.context)
  }

  // History

  async revisions(file: string): Promise<Array<Revision>> {
    const {history} = this.options
    if (!history) return []
    return history.revisions(file, this.context)
  }

  async revisionData(file: string, revisionId: string): Promise<EntryRecord> {
    const {history} = this.options
    if (!history) throw new Error('History not available')
    return history.revisionData(file, revisionId, this.context)
  }

  // Syncable

  async syncPending() {
    const {pending} = this.options
    if (!pending) return
    const {contentHash} = await this.db.meta()
    const mutations = await pending.pendingSince(contentHash)
    if (mutations.length > 0) await this.db.applyMutations(mutations)
  }

  async syncRequired(contentHash: string): Promise<boolean> {
    await this.syncPending()
    return this.db.syncRequired(contentHash)
  }

  async sync(contentHashes: Array<string>): Promise<SyncResponse> {
    await this.syncPending()
    return this.db.sync(contentHashes)
  }

  // Drafts

  private async persistEdit(mutation: EditMutation) {
    const {drafts} = this.options
    if (!drafts) return
    const update = base64.parse(mutation.update)
    const currentDraft = await this.getDraft(mutation.entryId)
    await this.storeDraft({
      entryId: mutation.entryId,
      fileHash: mutation.entry.fileHash,
      draft: currentDraft
        ? mergeUpdatesV2([currentDraft.draft, update])
        : update
    })
  }

  getDraft(entryId: string): Promise<Draft | undefined> {
    const {drafts} = this.options
    if (!drafts) throw new Error('Drafts not available')
    return drafts.getDraft(entryId, this.context)
  }

  storeDraft(draft: Draft): Promise<void> {
    const {drafts} = this.options
    if (!drafts) throw new Error('Drafts not available')
    return drafts.storeDraft(draft, this.context)
  }
}
