import {type Config, createConfig} from './Config.js'
import type {PreviewRequest} from './Preview.js'
import {WriteableGraph} from './db/WriteableGraph.js'

export interface ConnectionContext {
  apiKey?: string
  accessToken?: string
  preview?: PreviewRequest
}

export abstract class CMS<
  Definition extends Config = Config
> extends WriteableGraph {
  config: Definition

  constructor(config: Definition) {
    super()
    this.config = createConfig(config)
  }

  get schema(): Definition['schema'] {
    return this.config.schema as any
  }

  get workspaces(): Definition['workspaces'] {
    return this.config.workspaces
  }
}
