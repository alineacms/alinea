import {Backend} from '@alinea/backend/Backend'
import {FileData} from '@alinea/backend/data/FileData'
import {JsonLoader} from '@alinea/backend/loader/JsonLoader'
import {JWTPreviews} from '@alinea/backend/util/JWTPreviews'
import {Config, Workspaces} from '@alinea/core'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import fs from 'node:fs/promises'
import path from 'node:path'
import {ServeDrafts} from './ServeDrafts'

export interface ServeBackendOptions<T extends Workspaces> {
  cwd?: string
  port?: number
  config: Config<T>
  store: SqliteStore
}

export class ServeBackend<
  T extends Workspaces = Workspaces
> extends Backend<T> {
  reload: (config: Config<T>) => void
  constructor({
    cwd = process.cwd(),
    port = 4500,
    config,
    store
  }: ServeBackendOptions<T>) {
    const dashboardUrl = `http://localhost:${port}`
    const outDir = path.join(cwd, '.alinea')
    const data = new FileData({
      config,
      fs,
      loader: JsonLoader,
      rootDir: cwd
    })
    const drafts = new ServeDrafts({
      config,
      fs,
      dir: path.join(outDir, '.drafts'),
      outDir,
      store
    })
    const options = {
      dashboardUrl,
      createStore: async () => store,
      config,
      drafts: drafts,
      media: data,
      target: data,
      previews: new JWTPreviews('@alinea/backend/devserver')
    }
    super(options)
    this.reload = config => {
      data.options.config = config
      this.options.config = config
      drafts.options.config = config
    }
  }
}
