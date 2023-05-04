import {Backend} from 'alinea/backend/Backend'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {Config} from 'alinea/core'
import {Store} from 'alinea/store'
import {DevData} from './DevData.js'
import {DevDrafts} from './DevDrafts.js'

export interface DevServerOptions {
  config: Config
  createStore: () => Promise<Store>
  serverLocation: string
}

export class DevBackend extends Backend {
  constructor({config, createStore, serverLocation}: DevServerOptions) {
    const drafts = new DevDrafts({
      serverLocation
    })
    const data = new DevData({
      serverLocation
    })
    super({
      dashboardUrl: serverLocation,
      createStore,
      config,
      drafts: drafts,
      media: data,
      target: data,
      previews: new JWTPreviews('@alinea/backend/devserver')
    })
  }
}
