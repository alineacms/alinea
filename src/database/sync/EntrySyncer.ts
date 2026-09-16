import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import type {Database} from 'rado'
import {
  clearTemporaryTables,
  createTemporaryTables,
  dropTemporaryTables,
  prepareSyncQueries,
  type EntrySyncOptions,
  type EntrySyncTarget,
  type SyncQueries
} from './queries.js'
import {mergeTrees} from './ingest.js'
import {
  copyInitialUrls,
  deriveHierarchy,
  deriveStatus,
  deriveUrls,
  expandAffected,
  materializeAffected,
  validateEntries
} from './derive.js'

export {EntrySyncRoot} from './queries.js'
export type {EntrySyncTarget} from './queries.js'

/** Prepared, serialized source synchronization for one database connection. */
export class EntrySyncer implements AsyncDisposable {
  #db: Database
  #config: Config
  #queries = new Map<EntrySyncTarget, Promise<SyncQueries>>()
  #ready: Promise<void>
  #queue: Promise<unknown> = Promise.resolve()
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
    const task = this.#queue.then(() =>
      this.#sync(
        target,
        source,
        tree,
        fromRevision,
        options.previousTree,
        options.withinTransaction ?? false
      )
    )
    this.#queue = task.catch(() => {})
    return task
  }

  async #sync(
    target: EntrySyncTarget,
    source: RemoteSource,
    tree: ReadonlyTree,
    fromRevision: string,
    previousTree: ReadonlyTree | undefined,
    withinTransaction: boolean
  ): Promise<Array<string>> {
    const queries = await this.#queriesFor(target)
    const run = async (tx: Database) => {
      const materialized = new Set<string>()
      await clearTemporaryTables(queries)
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
      if (storedTree)
        await mergeTrees(
          tx,
          target.entries,
          this.#config,
          source,
          storedTree,
          tree,
          queries
        )
      else if (initial)
        // A cold sync is a merge from an empty tree.
        await mergeTrees(
          tx,
          target.entries,
          this.#config,
          source,
          ReadonlyTree.EMPTY,
          tree,
          queries
        )
      else
        throw new Error(
          'Cannot sync a populated database without a recorded source tree'
        )
      await expandAffected(tx, target.entries)
      await materializeAffected(tx, target, queries, materialized)
      const hierarchyChanged = await deriveHierarchy(
        tx,
        target.entries,
        queries
      )
      if (hierarchyChanged) {
        await expandAffected(tx, target.entries)
        await materializeAffected(tx, target, queries, materialized)
      }
      await deriveStatus(tx, queries)
      if (initial) await copyInitialUrls(queries)
      else await deriveUrls(tx, target.entries, this.#config, queries)
      await validateEntries(tx, target.changes ?? target.entries)
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
    await this.#queue
    const queries = this.#queries.get(target)
    if (!queries) return
    this.#queries.delete(target)
    await (await queries).free()
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.#queue
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
