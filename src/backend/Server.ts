import {
  Config,
  Connection,
  Draft,
  ResolveDefaults,
  SyncResponse
} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {EditMutation, Mutation, MutationType} from 'alinea/core/Mutation'
import {base64} from 'alinea/core/util/Encoding'
import {mergeUpdatesV2} from 'yjs'
import {Database} from './Database.js'
import {Drafts} from './Drafts.js'
import {History, Revision} from './History.js'
import {Media} from './Media.js'
import {Pending} from './Pending.js'
import {Previews} from './Previews'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {EntryResolver} from './resolver/EntryResolver.js'

export interface PreviewOptions {
  preview?: boolean
  previewToken?: string
}

export interface ServerOptions {
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

interface ServerContext extends ServerOptions {
  db: Database
  resolver: EntryResolver
  changes: ChangeSetCreator
}

export class Server {
  connect: (ctx: Connection.Context) => Connection
  constructor(private options: ServerOptions) {
    const context = {
      db: new Database(options.config, options.store),
      resolver: new EntryResolver(options.store, options.config.schema),
      changes: new ChangeSetCreator(options.config),
      ...this.options
    }
    this.connect = ctx => new ServerConnection(context, ctx)
  }
}

class ServerConnection implements Connection {
  constructor(
    protected server: ServerContext,
    protected ctx: Connection.Context
  ) {}

  // Api
  resolve = (params: Connection.ResolveParams) => {
    const {resolveDefaults} = this.server
    return this.server.resolver.resolve({...resolveDefaults, ...params})
  }

  // Target

  async mutate(mutations: Array<Mutation>): Promise<void> {
    const {target, media, changes, db} = this.server
    if (!target) throw new Error('Target not available')
    if (!media) throw new Error('Media not available')
    const changeSet = changes.create(mutations)
    await this.syncPending()
    const {contentHash} = await db.applyMutations(mutations)
    await target.mutate({contentHash, mutations: changeSet}, this.ctx)
    const tasks = []
    for (const mutation of mutations) {
      switch (mutation.type) {
        case MutationType.FileRemove:
          tasks.push(
            media.deleteUpload(
              {location: mutation.location, workspace: mutation.workspace},
              this.ctx
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
    const {previews} = this.server
    const user = this.ctx.user
    if (!user) return previews.sign({anonymous: true})
    return previews.sign({sub: user.sub})
  }

  // Media

  prepareUpload(file: string): Promise<Connection.UploadResponse> {
    const {media} = this.server
    if (!media) throw new Error('Media not available')
    return media.prepareUpload(file, this.ctx)
  }

  // History

  async revisions(file: string): Promise<Array<Revision>> {
    const {history} = this.server
    if (!history) return []
    return history.revisions(file, this.ctx)
  }

  async revisionData(file: string, revisionId: string): Promise<EntryRecord> {
    const {history} = this.server
    if (!history) throw new Error('History not available')
    return history.revisionData(file, revisionId, this.ctx)
  }

  // Syncable

  async syncPending() {
    const {pending, db} = this.server
    if (!pending) return
    const {contentHash} = await db.meta()
    const mutations = await pending.pendingSince(contentHash, this.ctx)
    if (mutations.length > 0) await db.applyMutations(mutations)
  }

  async syncRequired(contentHash: string): Promise<boolean> {
    const {db} = this.server
    await this.syncPending()
    return db.syncRequired(contentHash)
  }

  async sync(contentHashes: Array<string>): Promise<SyncResponse> {
    const {db} = this.server
    await this.syncPending()
    return db.sync(contentHashes)
  }

  // Drafts

  private async persistEdit(mutation: EditMutation) {
    const {drafts} = this.server
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
    const {drafts} = this.server
    if (!drafts) throw new Error('Drafts not available')
    return drafts.getDraft(entryId, this.ctx)
  }

  storeDraft(draft: Draft): Promise<void> {
    const {drafts} = this.server
    if (!drafts) throw new Error('Drafts not available')
    return drafts.storeDraft(draft, this.ctx)
  }
}
