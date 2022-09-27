import {Backend} from '@alinea/backend/Backend'
import {JWTPreviews} from '@alinea/backend/util/JWTPreviews'
import {Config, Workspaces} from '@alinea/core'
import {Store} from '@alinea/store'
import {DevData} from './DevData'
import {DevDrafts} from './DevDrafts'

export interface DevServerOptions<T extends Workspaces> {
  config: Config<T>
  createStore: () => Promise<Store>
  serverLocation: string
}

export class DevBackend<T extends Workspaces = Workspaces> extends Backend<T> {
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
