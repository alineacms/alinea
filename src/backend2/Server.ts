import {Previews} from 'alinea/backend/Previews'
import {Config, Future, Hub} from 'alinea/core'
import {Api} from './Api.js'
import {Database} from './Database.js'
import {File, Media} from './Media.js'
import {Store} from './Store.js'
import {Target} from './Target.js'
import {AlineaMeta} from './collection/AlineaMeta.js'

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

  constructor(public options: ServerOptions, public context: Hub.Context) {
    this.db = new Database(options.store, options.config)
  }

  ids() {
    return this.db.ids()
  }

  updates(request: AlineaMeta) {
    return this.db.updates(request)
  }

  publishEntries(params: Hub.PublishParams): Future {
    throw 'assert'
  }

  uploadFile(params: Hub.UploadParams): Future<File> {
    throw 'assert'
  }
}