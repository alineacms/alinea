import type {Config} from '../Config.js'
import type {Connection, UploadResponse} from '../Connection.js'
import type {Source} from '../source/Source.js'
import {type CommitRequest, sourceChanges} from './CommitRequest.js'
import {LocalDB} from './LocalDB.js'

export class EntryDB extends LocalDB {
  connect: () => Promise<Connection>

  constructor(
    config: Config,
    source: Source,
    connect: () => Promise<Connection>
  ) {
    super(config, source)
    this.connect = connect
  }

  async commit(request: CommitRequest): Promise<string> {
    const remote = await this.connect()
    const contentChanges = sourceChanges(request.changes)
    await this.indexChanges(contentChanges)
    try {
      const sha = await remote.commit(request)
      if (sha === request.intoSha) {
        await this.applyChanges(contentChanges)
        return this.sha
      }
    } finally {
      await this.syncWithRemote()
    }
    return this.sha
  }

  async prepareUpload(file: string): Promise<UploadResponse> {
    const remote = await this.connect()
    return remote.prepareUpload(file)
  }

  async syncWithRemote() {
    const remote = await this.connect()
    return this.syncWith(remote)
  }
}
