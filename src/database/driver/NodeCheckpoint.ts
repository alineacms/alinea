import type {Config} from '#/core/Config.js'
import {Graph, type GraphQuery, type AnyQueryResult} from '#/core/Graph.js'
import {DatabaseSync} from 'node:sqlite'
import {openCheckpoint, type CheckpointIdentity} from '../runtime/Checkpoint.js'
import type {EntryRuntime} from '../runtime/EntryRuntime.js'
import {nodeDatabase} from './NodeDatabase.js'

/** Deployment-pinned reads. No source parsing, cache copies or synchronization. */
export class NodeCheckpoint extends Graph {
  #closed = false
  #readers = 0
  #sqlite: DatabaseSync
  #runtime: EntryRuntime

  private constructor(sqlite: DatabaseSync, runtime: EntryRuntime) {
    super()
    this.#sqlite = sqlite
    this.#runtime = runtime
  }

  get config(): Config {
    return this.#runtime.config
  }

  static async open(
    config: Config,
    file: string,
    identity: CheckpointIdentity
  ) {
    const sqlite = new DatabaseSync(file, {readOnly: true})
    try {
      const {runtime} = await openCheckpoint(
        config,
        nodeDatabase(sqlite),
        identity
      )
      return new NodeCheckpoint(sqlite, runtime)
    } catch (error) {
      sqlite.close()
      throw error
    }
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (this.#closed) throw new Error('SQLite checkpoint is closed')
    this.#readers++
    try {
      return await this.#runtime.resolve(query)
    } finally {
      if (--this.#readers === 0 && this.#closed) this.#sqlite.close()
    }
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    if (!this.#readers) this.#sqlite.close()
  }
}
