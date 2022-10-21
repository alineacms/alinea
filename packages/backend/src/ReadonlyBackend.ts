import {Backend} from '@alinea/backend/Backend'
import {JWTPreviews} from '@alinea/backend/util/JWTPreviews'
import {Config} from '@alinea/core'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'

export interface ReadonlyBackendOptions<T> {
  config: Config<T>
  createStore: () => Promise<SqliteStore>
}

export class ReadonlyBackend<T> extends Backend<T> {
  constructor({config, createStore}: ReadonlyBackendOptions<T>) {
    super({
      dashboardUrl: '',
      createStore,
      config,
      drafts: undefined!,
      media: undefined!,
      target: undefined!,
      previews: new JWTPreviews('@alinea/backend/devserver')
    })
  }
}
