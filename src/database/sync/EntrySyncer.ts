import type {Config} from '#/core/Config.js'
import type {Source} from '#/core/source/Source.js'
import type {EntryReplacement, EntryRuntime} from '../runtime/EntryRuntime.js'
import {EntryCompiler} from './EntryCompiler.js'

function replacement(
  entry: EntryReplacement['entry'],
  childrenSha: string
): EntryReplacement {
  return {
    entry: {
      ...entry,
      childrenSha
    }
  }
}

function* replacements(
  entries: Iterable<EntryReplacement['entry']>,
  hashes: ReadonlyMap<string, string>
): Generator<EntryReplacement> {
  for (const entry of entries) {
    const childrenSha = hashes.get(entry.id)
    if (!childrenSha)
      throw new Error(`Missing logical tree hash for ${entry.id}`)
    yield replacement(entry, childrenSha)
  }
}

/**
 * Owns a source-bound compiler cache. SQLite remains the only query index;
 * every completed sync commits one coherent source revision.
 */
export class EntrySyncer implements AsyncDisposable {
  #compiler: EntryCompiler
  #source: Source
  #revision: string | undefined
  #queue: Promise<unknown> = Promise.resolve()
  #closed = false

  constructor(config: Config, source: Source) {
    this.#source = source
    this.#compiler = new EntryCompiler(config)
  }

  async sync(runtime: EntryRuntime): Promise<string> {
    const task = this.#queue.then(() => this.#sync(runtime))
    this.#queue = task.catch(() => {})
    return task
  }

  async close(): Promise<void> {
    this.#closed = true
    await this.#queue
    this.#revision = undefined
    await this.#compiler.close()
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }

  async #sync(runtime: EntryRuntime): Promise<string> {
    if (this.#closed) throw new Error('EntrySyncer is closed')
    const current = await runtime.getRevision()
    const source = await this.#compiler.sync(this.#source, current)
    const {revision} = source
    if (revision === current) {
      this.#revision = revision
      this.#compiler.discardPayloads()
      return revision
    }
    // A previous commit may have failed after the compiler advanced its source
    // tree. Without a fresh source delta, only a full replacement is safe.
    const replaceAll =
      source.replaceAll || this.#revision !== current || !source.changed
    const entryIds = replaceAll ? undefined : new Set(source.replaceEntryIds)
    if (replaceAll) await this.#compiler.loadPayloads(this.#source)
    const stored = entryIds
      ? await runtime.syncEntries(source.replaceEntryIds)
      : new Map()
    const next = await this.#compile(entryIds, stored)
    await runtime.apply({
      fromRevision: current,
      toRevision: revision,
      replaceEntryIds: source.replaceEntryIds,
      replaceAll,
      entries: next.entries
    })
    this.#revision = revision
    this.#compiler.discardPayloads()
    return revision
  }

  async #compile(
    entryIds: ReadonlySet<string> | undefined,
    stored: ReadonlyMap<string, EntryReplacement['entry']>
  ): Promise<{entries: Iterable<EntryReplacement>}> {
    const hashes = await this.#compiler.treeHashes()
    return {
      entries: replacements(this.#compiler.entries(entryIds, stored), hashes)
    }
  }
}
