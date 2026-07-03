import type {Config} from '../Config.js'
import type {AnyQueryResult, GraphQuery} from '../Graph.js'
import {EntryResolver} from './EntryResolver.js'
import type {EntryIndex} from './EntryIndex.js'
import type {EntryDocIndex} from './EntryDocIndex.js'

export class EntryDocResolver extends EntryResolver {
  constructor(
    config: Config,
    public docIndex: EntryDocIndex
  ) {
    super(config, docIndex as unknown as EntryIndex)
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return super.resolve(query)
  }
}
