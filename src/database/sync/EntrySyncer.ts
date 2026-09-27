import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {TaskQueue} from '#/core/util/Async.js'
import type {Database} from 'rado'
import {supportsJsonb} from '../entry/EntryData.js'
import {deriveEntries} from './Derive.js'
import {mergeTrees} from './Ingest.js'
import {prepareSyncQueries, type SyncQueries} from './SyncQueries.js'

export interface EntrySyncOptions {
  previousTree?: ReadonlyTree
  withinTransaction?: boolean
  /** Skip entry validation for a source whose entries were already validated. */
  validate?: boolean
  /**
   * Record the synced source tree in the state, so the database can be
   * reopened and synced from it. Defaults to true.
   */
  recordsTree?: boolean
}

/** Prepared, serialized source synchronization for one database connection. */
export class EntrySyncer {
  #db: Database
  #config: Config
  #queries?: Promise<SyncQueries>
  #queue = new TaskQueue()
  #closed = false

  constructor(config: Config, db: Database) {
    this.#config = config
    this.#db = db
  }

  /** Derive later syncs with another config; prepared statements are shared. */
  reconfigure(config: Config): Promise<void> {
    return this.#queue.run(async () => {
      this.#config = config
    })
  }

  /** Stream a source/tree diff directly into the canonical SQLite table. */
  sync(
    source: RemoteSource,
    tree: ReadonlyTree,
    fromRevision: string,
    options: EntrySyncOptions = {}
  ): Promise<Array<string>> {
    if (this.#closed) return Promise.reject(new Error('EntrySyncer is closed'))
    return this.#queue.run(() =>
      this.#sync(source, tree, fromRevision, options)
    )
  }

  async #sync(
    source: RemoteSource,
    tree: ReadonlyTree,
    fromRevision: string,
    {
      previousTree,
      withinTransaction = false,
      validate = true,
      recordsTree = true
    }: EntrySyncOptions
  ): Promise<Array<string>> {
    const queries = await this.#prepared()
    const run = async () => {
      const state = await queries.revision.get()
      if (state?.revision !== fromRevision)
        throw new Error('Database revision mismatch')
      if (previousTree && previousTree.sha !== fromRevision)
        throw new Error('Cached tree revision mismatch')
      const stored = previousTree ? undefined : await queries.tree.get()
      const storedTree =
        previousTree ??
        (stored?.tree ? new ReadonlyTree(stored.tree) : undefined)
      if (!storedTree && (await queries.entryCount.get())?.value !== 0)
        throw new Error(
          'Cannot sync a populated database without a recorded source tree'
        )
      const changes = await mergeTrees(
        this.#config,
        source,
        storedTree ?? ReadonlyTree.EMPTY,
        tree,
        queries
      )
      const changed = await deriveEntries(
        this.#config,
        queries,
        changes,
        validate
      )
      await queries.setRevision.run({
        revision: tree.sha,
        tree: recordsTree ? JSON.stringify(tree) : null
      })
      return changed
    }
    return withinTransaction ? run() : this.#db.transaction(run, {async: true})
  }

  #prepared(): Promise<SyncQueries> {
    return (this.#queries ??= supportsJsonb(this.#db).then(jsonb =>
      prepareSyncQueries(this.#db, jsonb)
    ))
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.#queue.drain()
    const queries = this.#queries
    this.#queries = undefined
    if (queries) (await queries).free()
  }
}
