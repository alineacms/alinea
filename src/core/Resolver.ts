import {AnyQueryResult, GraphQuery} from './Graph.js'

export interface Resolver {
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>>
}
