import {Backend} from '@alinea/backend/Backend'
import {JWTPreviews} from '@alinea/backend/util/JWTPreviews'
import {Config, Workspaces} from '@alinea/core'
import {Store} from '@alinea/store'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {DevDrafts} from './DevDrafts'

export interface DevServerOptions<T extends Workspaces> {
  config: Config<T>
  createStore: () => Promise<Store>
  createDraftStore: () => Promise<SqliteStore>
}

export class DevBackend<T extends Workspaces = Workspaces> extends Backend<T> {
  constructor({config, createStore, createDraftStore}: DevServerOptions<T>) {
    const drafts = new DevDrafts({
      createStore: createDraftStore
    })
    super({
      dashboardUrl: undefined!,
      createStore,
      config,
      drafts: drafts,
      media: undefined!,
      target: undefined!,
      previews: new JWTPreviews('@alinea/backend/devserver')
    })
  }
}
