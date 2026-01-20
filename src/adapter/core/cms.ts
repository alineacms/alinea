import {CMS} from 'alinea/core/CMS'
import type {Config} from 'alinea/core/Config'
import type {UploadResponse} from 'alinea/core/Connection'
import type {AnyQueryResult, GraphQuery} from 'alinea/core/Graph'

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
