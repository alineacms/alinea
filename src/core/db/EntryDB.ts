import type {Config} from '../Config.js'
import type {Source} from '../source/Source.js'
import type {CommitRequest} from './CommitRequest.js'
import type {EntryTarget} from './EntryTarget.js'
import {LocalDB} from './LocalDB.js'

export class EntryDB extends LocalDB {
  #remote: EntryTarget

  constructor(config: Config, source: Source, remote: EntryTarget) {
    super(config, source)
    this.#remote = remote
  }

  async commit(request: CommitRequest) {
    const sourceChanges = request.changes.filter(
      change => change.op === 'add' || change.op === 'delete'
    )
    await this.indexChanges(sourceChanges)
    try {
      const sha = await this.#remote.commit(request)
      if (sha === request.intoSha) {
        await this.applyChanges(sourceChanges)
        return
      }
    } finally {
      await this.syncWithRemote()
    }
  }

  syncWithRemote() {
    return this.syncWith(this.#remote)
  }
}
