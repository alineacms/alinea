import {Database, Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {History, Revision} from 'alinea/backend/History'
import {Store} from 'alinea/backend/Store'
import {Config, Connection} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'

export class DebugCloud implements Media, Target, History {
  db: Database
  constructor(public config: Config, public store: Store) {
    this.db = new Database(config, store)
  }

  async mutate(params: Connection.MutateParams, ctx: Connection.Context) {
    const mutations = params.mutations.flatMap(mutate => mutate.meta)
    console.log('mutate', mutations)
    await this.db.applyMutations(mutations)
  }

  prepareUpload(
    file: string,
    ctx: Connection.Context
  ): Promise<Connection.UploadResponse> {
    throw new Error(`Not implemented`)
  }

  async delete(
    {location, workspace}: Connection.DeleteParams,
    ctx: Connection.Context
  ): Promise<void> {
    console.log(`delete`, location, workspace)
  }

  async revisions(
    file: string,
    ctx: Connection.Context
  ): Promise<Array<Revision>> {
    return []
  }

  async revisionData(
    file: string,
    revision: string,
    ctx: Connection.Context
  ): Promise<EntryRecord> {
    throw new Error(`Not implemented`)
  }
}

export function createCloudDebugHandler(config: Config, store: Store) {
  const api = new DebugCloud(config, store)
  return new Handler({
    store,
    config,
    target: api,
    media: api,
    history: api,
    previews: new JWTPreviews('dev')
  })
}
