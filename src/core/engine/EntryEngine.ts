import type {ChangesBatch} from '../source/Change.js'
import type {EntrySnapshot} from './EntrySnapshot.js'
import type {EntryEngineSource} from './EntryEngineSource.js'
import type {
  EntryQueryOptions,
  EntryQueryPlan,
  TracedEntryQueryResult
} from './EntryPlanner.js'
import {emptyQueryTrace} from './QueryTrace.js'

export interface EntryEngine {
  readonly graphSha: string
  readonly snapshot: EntrySnapshot

  query<Value>(
    plan: EntryQueryPlan,
    options: EntryQueryOptions & {trace: true}
  ): Promise<TracedEntryQueryResult<Value>>
  query<Value>(
    plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): Promise<Value>

  applyChanges(batch: ChangesBatch): Promise<EntryEngine>
  exportSnapshot(): EntrySnapshot
}

export interface MemoryEntryEngineOptions {
  snapshot: EntrySnapshot
  source?: EntryEngineSource
}

export class MemoryEntryEngine implements EntryEngine {
  readonly snapshot: EntrySnapshot
  readonly #source: EntryEngineSource | undefined

  constructor(options: MemoryEntryEngineOptions) {
    this.snapshot = options.snapshot
    this.#source = options.source
  }

  get graphSha() {
    return this.snapshot.graphSha
  }

  query<Value>(
    plan: EntryQueryPlan,
    options: EntryQueryOptions & {trace: true}
  ): Promise<TracedEntryQueryResult<Value>>
  query<Value>(
    plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): Promise<Value>
  async query<Value>(
    _plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): Promise<Value | TracedEntryQueryResult<Value>> {
    if (options?.trace) {
      return {
        value: undefined as Value,
        trace: emptyQueryTrace(this.graphSha)
      }
    }
    return undefined as Value
  }

  async applyChanges(_batch: ChangesBatch): Promise<EntryEngine> {
    throw new Error('Entry engine change application is not implemented yet')
  }

  exportSnapshot(): EntrySnapshot {
    return this.snapshot
  }

  get source(): EntryEngineSource | undefined {
    return this.#source
  }
}
