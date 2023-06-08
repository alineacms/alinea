import {Config, Connection, Entry, EntryPhase} from 'alinea/core'
import {Database} from './Database.js'
import {Media} from './Media.js'
import {Previews} from './Previews'
import {Resolver} from './Resolver.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {ChangeSet} from './data/ChangeSet.js'
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
}

export class Server implements Connection {
  db: Database
  resolver: Resolver

  constructor(
    public options: ServerOptions,
    public context: Connection.Context
  ) {
    this.db = new Database(options.store, options.config)
    this.resolver = new Resolver(options.store, options.config.schema)
  }

  // Api

  resolve(params: Connection.ResolveParams) {
    return this.resolver.resolve(params)
  }

  previewToken(): Promise<string> {
    const {previews} = this.options
    const user = this.context.user
    if (!user) return previews.sign({anonymous: true})
    return previews.sign({sub: user.sub})
  }

  async saveDraft(entry: Entry): Promise<void> {
    const {target} = this.options
    const changes = await ChangeSet.create(
      this.db,
      [entry],
      EntryPhase.Draft,
      target.canRename
    )
    await target.publishChanges({changes}, this.context)
  }

  async publishDrafts(entries: Array<Entry>): Promise<void> {
    const {target} = this.options
    const changes = await ChangeSet.create(
      this.db,
      entries,
      EntryPhase.Published,
      target.canRename
    )
    await target.publishChanges({changes}, this.context)
  }

  uploadFile(params: Connection.UploadParams): Promise<Media.File> {
    throw 'assert'
  }

  // Syncable

  versionIds() {
    return this.db.versionIds()
  }

  updates(request: AlineaMeta) {
    return this.db.updates(request)
  }
}
