import {Backend} from 'alinea/backend/Backend'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {Config} from 'alinea/core'
import {Store} from 'alinea/store'
import {DevData} from './DevData.js'
import {DevDrafts} from './DevDrafts.js'

export interface DevServerOptions<T> {
  config: Config<T>
  createStore: () => Promise<Store>
  serverLocation: string
}

export class DevBackend<T> extends Backend<T> {
  constructor({config, createStore, serverLocation}: DevServerOptions<T>) {
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
