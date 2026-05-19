import type {ChangesBatch} from '../source/Change.js'
import type {Entry} from '../Entry.js'
import type {GraphQuery, Projection} from '../Graph.js'
import type {EntrySnapshot} from './EntrySnapshot.js'
import type {EntryEngineSource} from './EntryEngineSource.js'
import {groupEntries} from './EntryGroup.js'
import {materializeEntry} from './EntryMaterializer.js'
import {orderEntries} from './EntryOrder.js'
import {projectEntry} from './EntryProjection.js'
import {
  compileEntryQueryConstraints,
  unsupportedEntryQueryReason
} from './EntryQueryCompiler.js'
import type {
  EntryLanguageRow,
  EntryNodeRow,
  EntryRowId,
  EntryVersionRow
} from './EntryRows.js'
import type {
  EntryQueryOptions,
  EntryQueryPlan,
  TracedEntryQueryResult
} from './EntryPlanner.js'
import {SnapshotEntryPlanner} from './SnapshotEntryPlanner.js'
import {createQueryTrace, mergeQueryTraces} from './QueryTrace.js'

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
  readonly #planner: SnapshotEntryPlanner
  readonly #versions: Map<EntryRowId, EntryVersionRow>
  readonly #languages: Map<string, EntryLanguageRow>
  readonly #nodes: Map<string, EntryNodeRow>
  readonly #entries = new Map<EntryRowId, Entry>()

  constructor(options: MemoryEntryEngineOptions) {
    this.snapshot = options.snapshot
    this.#source = options.source
    this.#planner = new SnapshotEntryPlanner(this.snapshot)
    this.#versions = new Map(
      this.snapshot.rows.versions.map(row => [row.rowId, row])
    )
    this.#languages = new Map(
      this.snapshot.rows.languages.map(row => [row.languageId, row])
    )
    this.#nodes = new Map(
      this.snapshot.rows.nodes.map(row => [row.nodeId, row])
    )
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
    plan: EntryQueryPlan,
    options?: EntryQueryOptions
  ): Promise<Value | TracedEntryQueryResult<Value>> {
    const unsupported = unsupportedEntryQueryReason(plan.query)
    if (unsupported) throw new Error(`Unsupported engine query: ${unsupported}`)
    const constraints =
      plan.constraints ?? compileEntryQueryConstraints(plan.query)
    const candidatePlan = this.#planner.candidates(
      {...plan, constraints},
      options
    )
    const query = plan.query as GraphQuery<Projection>
    let rowIds = candidatePlan.rowIds
    let entries =
      query.count && !query.groupBy
        ? []
        : rowIds.flatMap(rowId => {
            const entry = this.#entryForRow(rowId)
            return entry ? [entry] : []
          })
    if (query.groupBy && !Array.isArray(query.groupBy))
      entries = groupEntries(entries, query.groupBy)
    if (query.orderBy) orderEntries(entries, query.orderBy)

    if (query.skip) {
      if (query.count && !query.groupBy) rowIds = rowIds.slice(query.skip)
      else entries.splice(0, query.skip)
    }
    if (query.take) {
      if (query.count && !query.groupBy) rowIds = rowIds.slice(0, query.take)
      else entries.splice(query.take)
    }

    const value = (
      query.count
        ? query.groupBy
          ? entries.length
          : rowIds.length
        : query.get
          ? projectEntry(entries[0], query.select)
          : query.first
            ? entries[0]
              ? projectEntry(entries[0], query.select)
              : null
            : entries.map(entry => projectEntry(entry, query.select))
    ) as Value

    if (options?.trace) {
      return {
        value,
        trace: mergeQueryTraces(
          candidatePlan.trace,
          createQueryTrace({
            graphSha: this.graphSha,
            nodes: entries.map(entry => entry.id)
          })
        )
      }
    }
    return value
  }

  #entryForRow(rowId: EntryRowId): Entry | undefined {
    const cached = this.#entries.get(rowId)
    if (cached) return cached
    const version = this.#versions.get(rowId)
    const language = version && this.#languages.get(version.languageId)
    const node = version && this.#nodes.get(version.nodeId)
    if (!version || !language || !node) return
    const entry = materializeEntry({version, language, node})
    this.#entries.set(rowId, entry)
    return entry
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
