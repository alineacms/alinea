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

  async mutate(
    mutations: Array<Mutation>
  ): Promise<{sha: string; remote: Promise<string>}> {
    const from = await this.source.getTree()
    const tx = new EntryTransaction(this.config, this.index, this.source, from)
    tx.apply(mutations)
    const request = await tx.toRequest()
    const contentChanges = sourceChanges(request)
    const sha = this.indexChanges(contentChanges)
    return {
      sha: await sha,
      remote: sha.then(async () => {
        try {
          const remote = await this.connect()
          await remote.mutate(mutations)
          await this.applyChanges(contentChanges)
        } finally {
          await this.syncWithRemote()
        }
        return this.sha
      })
    }
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
