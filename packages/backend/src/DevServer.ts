import {Config, Workspaces} from '@alinea/core'
import {Store} from '@alinea/store'
import fs from 'node:fs/promises'
import path from 'node:path'
import {FileData} from './data/FileData'
import {FileDrafts} from './drafts/FileDrafts'
import {JsonLoader} from './loader/JsonLoader'
import {Server} from './Server'
import {JWTPreviews} from './util/JWTPreviews'

export interface DevServerOptions<T extends Workspaces> {
  cwd?: string
  port?: number
  config: Config<T>
  createStore: () => Promise<Store>
}

export class DevServer<T extends Workspaces = Workspaces> extends Server<T> {
  constructor({
    cwd = process.cwd(),
    port = 4500,
    config,
    createStore
  }: DevServerOptions<T>) {
    const dashboardUrl = `http://localhost:${port}`
    const outDir = path.join(cwd, '.alinea')
    const data = new FileData({
      config,
      fs,
      loader: JsonLoader,
      rootDir: cwd
    })
    const drafts = new FileDrafts({
      fs,
      dir: path.join(outDir, '.drafts')
    })
    super({
      dashboardUrl,
      createStore,
      config,
      drafts: drafts,
      media: data,
      target: data,
      previews: new JWTPreviews('@alinea/backend/devserver')
    })
  }
}
