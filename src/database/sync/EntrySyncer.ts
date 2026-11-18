import type {Config} from '#/core/Config.js'
import type {SyncProgress, SyncStats} from '#/core/db/LocalStore.js'
import {timeStep} from '#/core/db/SyncStats.js'
import {compareTrees, type TreeReader} from '#/core/source/CompareTrees.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {TaskQueue} from '#/core/util/Async.js'
import type {Database} from 'rado'
import {supportsJsonb} from '../entry/EntryData.js'
import {deriveEntries} from './Derive.js'
import {mergeChanges, mergeTrees} from './Ingest.js'
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
  /**
   * Reads the directories of both revisions by sha, for a sync to a tree
   * sha: it reads only directories that changed, and records no tree.
   */
  reader?: TreeReader
  onProgress?(progress: SyncProgress): void
  stats?: SyncStats
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
    tree: ReadonlyTree | string,
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
    tree: ReadonlyTree | string,
    fromRevision: string,
    {
      previousTree,
      withinTransaction = false,
      validate = true,
      recordsTree = true,
      reader,
      onProgress,
      stats
    }: EntrySyncOptions
  ): Promise<Array<string>> {
    const queries = await this.#prepared()
    const run = async () => {
      const state = await queries.revision.get()
      if (state?.revision !== fromRevision)
        throw new Error('Database revision mismatch')
      const changes =
        typeof tree === 'string'
          ? await mergeChanges(
              this.#config,
              source,
              await compareTrees(reader!, fromRevision, tree),
              queries,
              {onProgress, stats}
            )
          : await mergeTrees(
              this.#config,
              source,
              await this.#storedTree(queries, fromRevision, previousTree),
              tree,
              queries,
              {onProgress, stats}
            )
      const changed = await timeStep(stats, 'derive', () =>
        deriveEntries(this.#config, queries, changes, validate, stats)
      )
      const recorded = typeof tree !== 'string' && recordsTree
      await queries.setRevision.run({
        revision: typeof tree === 'string' ? tree : tree.sha,
        tree: recorded ? JSON.stringify(tree) : null
      })
      return changed
    }
    return withinTransaction ? run() : this.#db.transaction(run, {async: true})
  }

  async #storedTree(
    queries: SyncQueries,
    fromRevision: string,
    previousTree?: ReadonlyTree
  ): Promise<ReadonlyTree> {
    if (previousTree && previousTree.sha !== fromRevision)
      throw new Error('Cached tree revision mismatch')
    if (previousTree) return previousTree
    const stored = await queries.tree.get()
    if (stored?.tree) return new ReadonlyTree(stored.tree)
    if ((await queries.entryCount.get())?.value !== 0)
      throw new Error(
        'Cannot sync a populated database without a recorded source tree'
      )
    return ReadonlyTree.EMPTY
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
