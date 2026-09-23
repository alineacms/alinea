import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {TaskQueue} from '#/core/util/Async.js'
import type {Database, Table} from 'rado'
import {
  DatabaseStateTable,
  type DatabaseStateColumns
} from '../DatabaseTables.js'
import {supportsJsonb} from '../entry/EntryData.js'
import {EntryIndexTable, type EntryIndexTarget} from '../entry/EntryTable.js'
import {deriveEntries} from './Derive.js'
import {mergeTrees} from './Ingest.js'
import {prepareSyncQueries, type SyncQueries} from './SyncQueries.js'

export interface EntrySyncTarget {
  entries: EntryIndexTarget
  state: Table<typeof DatabaseStateColumns>
  /**
   * Whether the state records the synced source tree, so the database can be
   * reopened and synced from it. A temporary overlay keeps its tree in memory.
   */
  recordsTree?: boolean
}

export const EntrySyncRoot: EntrySyncTarget = {
  entries: EntryIndexTable,
  state: DatabaseStateTable
}

export interface EntrySyncOptions {
  previousTree?: ReadonlyTree
  withinTransaction?: boolean
  /** Skip entry validation for a source whose entries were already validated. */
  validate?: boolean
}

/** Prepared, serialized source synchronization for one database connection. */
export class EntrySyncer implements AsyncDisposable {
  #db: Database
  #config: Config
  #queries = new Map<EntrySyncTarget, Promise<SyncQueries>>()
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
    target: EntrySyncTarget,
    source: RemoteSource,
    tree: ReadonlyTree,
    fromRevision: string,
    options: EntrySyncOptions = {}
  ): Promise<Array<string>> {
    if (this.#closed) return Promise.reject(new Error('EntrySyncer is closed'))
    return this.#queue.run(() =>
      this.#sync(
        target,
        source,
        tree,
        fromRevision,
        options.previousTree,
        options.withinTransaction ?? false,
        options.validate ?? true
      )
    )
  }

  async #sync(
    target: EntrySyncTarget,
    source: RemoteSource,
    tree: ReadonlyTree,
    fromRevision: string,
    previousTree: ReadonlyTree | undefined,
    withinTransaction: boolean,
    validate: boolean
  ): Promise<Array<string>> {
    const queries = await this.#queriesFor(target)
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
        tree: target.recordsTree === false ? null : JSON.stringify(tree)
      })
      return changed
    }
    return withinTransaction ? run() : this.#db.transaction(run, {async: true})
  }

  #queriesFor(target: EntrySyncTarget): Promise<SyncQueries> {
    const cached = this.#queries.get(target)
    if (cached) return cached
    const queries = supportsJsonb(this.#db).then(jsonb =>
      prepareSyncQueries(this.#db, target, jsonb)
    )
    this.#queries.set(target, queries)
    return queries
  }

  /** Release prepared statements belonging to a closed named target. */
  async release(target: EntrySyncTarget): Promise<void> {
    await this.#queue.drain()
    const queries = this.#queries.get(target)
    if (!queries) return
    this.#queries.delete(target)
    await (await queries).free()
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.#queue.drain()
    const queries = Array.from(this.#queries.values())
    this.#queries.clear()
    await Promise.all(
      queries.map(async statements => (await statements).free())
    )
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}
