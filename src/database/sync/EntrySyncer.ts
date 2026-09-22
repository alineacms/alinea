import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {TaskQueue} from '#/core/util/Async.js'
import type {Database, Table} from 'rado'
import {
  DatabaseStateTable,
  type DatabaseStateColumns
} from '../DatabaseTables.js'
import {EntryIndexTable, type EntryIndexTarget} from '../entry/EntryTable.js'
import {
  clearTemporaryTables,
  createTemporaryTables,
  dropTemporaryTables,
  prepareSyncQueries,
  type SyncQueries
} from './SyncQueries.js'
import {mergeTrees} from './Ingest.js'
import {
  deriveHierarchy,
  deriveStatus,
  deriveUrls,
  expandAffected,
  materializeAffected,
  validateEntries
} from './Derive.js'

export interface EntrySyncTarget {
  name: string
  entries: EntryIndexTarget
  changes?: EntryIndexTarget
  state: Table<typeof DatabaseStateColumns>
}

export const EntrySyncRoot: EntrySyncTarget = {
  name: 'root',
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
  #ready: Promise<void>
  #queue = new TaskQueue()
  #closed = false

  constructor(config: Config, db: Database) {
    this.#config = config
    this.#db = db
    this.#ready = createTemporaryTables(this.#db)
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
    const run = async (tx: Database) => {
      const materialized = new Set<string>()
      await clearTemporaryTables(tx, queries)
      const state = await queries.revision.get()
      if (state?.revision !== fromRevision)
        throw new Error('Database revision mismatch')
      if (previousTree && previousTree.sha !== fromRevision)
        throw new Error('Cached tree revision mismatch')
      const storedTree =
        previousTree ?? (state.tree ? new ReadonlyTree(state.tree) : undefined)
      const initial = storedTree
        ? storedTree.isEmpty
        : (await queries.entryCount.get())?.value === 0
      if (!storedTree && !initial)
        throw new Error(
          'Cannot sync a populated database without a recorded source tree'
        )
      await mergeTrees(
        tx,
        target.entries,
        this.#config,
        source,
        storedTree ?? ReadonlyTree.EMPTY,
        tree,
        queries
      )
      await expandAffected(tx, target.entries)
      await materializeAffected(tx, target, queries, materialized)
      const hierarchyChanged = await deriveHierarchy(
        tx,
        target.entries,
        queries
      )
      if (hierarchyChanged) {
        // The cascade table is deliberately left as is: deriveHierarchy rewrote
        // parentId/parents, so re-walking the same roots picks up entries that
        // moved under them, and `insert or ignore` keeps this idempotent.
        await expandAffected(tx, target.entries)
        await materializeAffected(tx, target, queries, materialized)
      }
      await deriveStatus(tx, queries)
      if (initial) await queries.copyInitialUrls.run()
      else await deriveUrls(tx, target.entries, this.#config, queries)
      if (validate) await validateEntries(tx, target.changes ?? target.entries)
      const changed = await queries.changedIds.all()
      await queries.setRevision.run({
        revision: tree.sha,
        tree: target.changes ? null : JSON.stringify(tree)
      })
      return changed.map(row => row.id)
    }
    return withinTransaction
      ? run(this.#db)
      : this.#db.transaction(run, {async: true})
  }

  #queriesFor(target: EntrySyncTarget): Promise<SyncQueries> {
    const cached = this.#queries.get(target)
    if (cached) return cached
    const queries = this.#ready.then(() => prepareSyncQueries(this.#db, target))
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
    await this.#ready
    const queries = Array.from(this.#queries.values())
    this.#queries.clear()
    await Promise.all(
      queries.map(async statements => (await statements).free())
    )
    await dropTemporaryTables(this.#db)
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}
