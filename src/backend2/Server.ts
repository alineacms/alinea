import {Previews} from 'alinea/backend/Previews'
import {Storage} from 'alinea/backend/Storage'
import {Config, Connection, Future} from 'alinea/core'
import {Api} from './Api.js'
import {Database} from './Database.js'
import {File, Media} from './Media.js'
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

export class Server implements Api {
  db: Database

  constructor(
    public options: ServerOptions,
    public context: Connection.Context
  ) {
    this.db = new Database(options.store, options.config)
  }

  ids() {
    return this.db.ids()
  }

  updates(request: AlineaMeta) {
    return this.db.updates(request)
  }

  async publishEntries({entries}: Connection.PublishParams): Future<void> {
    const {config, target} = this.options
    const changes = await Storage.publishChanges(config, entries)
    return target.publish(entries)
  }

  uploadFile(params: Connection.UploadParams): Future<File> {
    throw 'assert'
  }
}
