import {Config, Connection} from 'alinea/core'
import {Selection} from 'alinea/core/pages/Selection'
import {Database} from './Database.js'
import {File, Media} from './Media.js'
import {Previews} from './Previews'
import {Resolver} from './Resolver.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
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

  resolve(selection: Selection) {
    return this.resolver.resolve(selection)
  }

  async publishEntries({entries}: Connection.PublishParams): Promise<void> {
    const {config, target} = this.options
    throw new Error('todo')
  }

  uploadFile(params: Connection.UploadParams): Promise<File> {
    throw 'assert'
  }

  // Syncable

  ids() {
    return this.db.ids()
  }

  updates(request: AlineaMeta) {
    return this.db.updates(request)
  }
}
