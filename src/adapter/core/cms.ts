import {CMS} from '#/core/CMS.js'
import type {Config} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'

const configOnly =
  "Import createCMS from 'alinea/server' or a framework adapter such as 'alinea/next' to query content."

export class CoreCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  async sync(): Promise<string> {
    throw new Error(configOnly)
  }
  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    throw new Error(configOnly)
  }
  async mutate(): Promise<{sha: string}> {
    throw new Error(configOnly)
  }
  async prepareUpload(file: string): Promise<UploadResponse> {
    throw new Error(configOnly)
  }
}

export function createCMS<Definition extends Config>(config: Definition) {
  return new CoreCMS(config)
}
