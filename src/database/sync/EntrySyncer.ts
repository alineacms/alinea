import type {Source} from '#/core/source/Source.js'
import type {EntryRuntime} from '../runtime/EntryRuntime.js'

/**
 * Source-bound scheduling only. SQLite is both the sync state and query index;
 * the synchronizer never retains a second source or entry index.
 */
export class EntrySyncer implements AsyncDisposable {
  #source: Source
  #queue: Promise<unknown> = Promise.resolve()
  #closed = false

  constructor(source: Source) {
    this.#source = source
  }

  async sync(runtime: EntryRuntime): Promise<EntrySyncResult> {
    const task = this.#queue.then(() => this.#sync(runtime))
    this.#queue = task.catch(() => {})
    return task
  }

  async close(): Promise<void> {
    this.#closed = true
    await this.#queue
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }

  async #sync(runtime: EntryRuntime): Promise<EntrySyncResult> {
    if (this.#closed) throw new Error('EntrySyncer is closed')
    const current = await runtime.getRevision()
    const tree = await this.#source.getTreeIfDifferent(current)
    if (!tree) return {revision: current, changedEntryIds: []}
    const changedEntryIds = await runtime.syncSource(
      this.#source,
      tree,
      current
    )
    return {revision: tree.sha, changedEntryIds}
  }
}

export interface EntrySyncResult {
  revision: string
  /** Includes source changes, deletions, and entries changed by inheritance. */
  changedEntryIds: ReadonlyArray<string>
}
