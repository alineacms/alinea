import {Config, Connection} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Graph} from 'alinea/core/Graph'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {Database} from './Database.js'
import {History, Revision} from './History.js'
import {Media} from './Media.js'
import {Previews} from './Previews'
import {ResolveDefaults, Resolver} from './Resolver.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {AlineaMeta} from './db/AlineaMeta.js'

export interface PreviewOptions {
  preview?: boolean
  previewToken?: string
}

export type ServerOptions = {
  config: Config
  store: Store
  target: Target
  media: Media
  previews: Previews
  history?: History
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
    this.db = new Database(options.store, options.config)
    this.resolver = new Resolver(options.store, options.config.schema)
    this.graph = new Graph(this.options.config, this.resolve)
    this.changes = new ChangeSetCreator(options.config)
  }

  // Api

  resolve = (params: Connection.ResolveParams) => {
    const {resolveDefaults} = this.options
    return this.resolver.resolve({...resolveDefaults, ...params})
  }

  async mutate(mutations: Array<Mutation>): Promise<void> {
    const {target} = this.options
    const changes = this.changes.create(mutations)
    await target.mutate({mutations: changes}, this.context)
    for (const mutation of mutations) {
      if (mutation.type === MutationType.FileRemove) {
        await this.options.media.delete(
          {location: mutation.location, workspace: mutation.workspace},
          this.context
        )
      }
    }
  }

  previewToken(): Promise<string> {
    const {previews} = this.options
    const user = this.context.user
    if (!user) return previews.sign({anonymous: true})
    return previews.sign({sub: user.sub})
  }

  prepareUpload(file: string): Promise<Connection.UploadResponse> {
    const {media} = this.options
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

  versionIds() {
    return this.db.versionIds()
  }

  updates(request: AlineaMeta) {
    return this.db.updates(request)
  }
}
