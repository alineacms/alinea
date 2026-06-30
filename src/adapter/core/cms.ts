import {CMS} from '#/core/CMS.js'
import type {Config} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'

export class CoreCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  async sync(): Promise<string> {
    throw new Error('Not implemented')
  }
  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    throw new Error('Not implemented')
  }
  async mutate(): Promise<{sha: string}> {
    throw new Error('Not implemented')
  }
  async prepareUpload(file: string): Promise<UploadResponse> {
    throw new Error('Not implemented')
  }
}

export function createCMS<Definition extends Config>(config: Definition) {
  return new CoreCMS(config)
}
