import type {Config} from '../Config.js'
import type {
  LocalConnection,
  UploadMetadata,
  UploadResponse
} from '../Connection.js'
import type {Source} from '../source/Source.js'
import type {CommitRequest} from './CommitRequest.js'
import {LocalDB} from './LocalDB.js'
import type {Mutation} from './Mutation.js'

export class EntryDB extends LocalDB {
  connect: () => Promise<LocalConnection>

  constructor(
    config: Config,
    source: Source,
    connect: () => Promise<LocalConnection>
  ) {
    super(config, source)
    this.connect = connect
  }

  async mutate(
    mutations: Array<Mutation>
  ): Promise<{sha: string; remote: Promise<string>}> {
    const {sha} = await super.mutate(mutations)
    return {
      sha,
      remote: (async () => {
        try {
          const remote = await this.connect()
          await remote.mutate(mutations)
        } finally {
          await this.syncWithRemote()
        }
        return await this.sha
      })()
    }
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    throw new Error('This must be implemented on the server')
  }

  async prepareUpload(
    file: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    const remote = await this.connect()
    return remote.prepareUpload(file, metadata)
  }

  async syncWithRemote() {
    const remote = await this.connect()
    return this.syncWith(remote)
  }
}
