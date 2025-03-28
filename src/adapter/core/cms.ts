import {CMS} from 'alinea/core/CMS'
import type {Config} from 'alinea/core/Config'
import type {UploadResponse} from 'alinea/core/Connection.js'
import type {AnyQueryResult, GraphQuery} from 'alinea/core/Graph.js'
import type {Mutation} from 'alinea/core/db/Mutation.js'

export class CoreCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    throw new Error('Not implemented')
  }
  async mutate(mutations: Array<Mutation>): Promise<void> {
    throw new Error('Not implemented')
  }
  async prepareUpload(file: string): Promise<UploadResponse> {
    throw new Error('Not implemented')
  }
}

export function createCMS<Definition extends Config>(config: Definition) {
  return new CoreCMS(config)
}
