import type {Config} from '../Config.js'
import type {LocalConnection, UploadResponse} from '../Connection.js'
import type {Source} from '../source/Source.js'
import {type CommitRequest, sourceChanges} from './CommitRequest.js'
import {EntryTransaction} from './EntryTransaction.js'
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

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    const from = await this.source.getTree()
    const tx = new EntryTransaction(this.config, this.index, this.source, from)
    tx.apply(mutations)
    const request = await tx.toRequest()
    const contentChanges = sourceChanges(request)
    await this.applyChanges(contentChanges)
    let sha = await this.sync()
    try {
      const remote = await this.connect()
      await remote.mutate(mutations)
    } finally {
      sha = await this.syncWithRemote()
    }
    return {sha}
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    throw new Error('This must be implemented on the server')
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
