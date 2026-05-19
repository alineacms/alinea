import type {EntrySnapshot} from './EntrySnapshot.js'
import {
  indexKey,
  indexValue,
  NULL_INDEX_VALUE
} from './EntrySnapshotIndex.js'
import type {EntryNodeId, EntryRowId} from './EntryRows.js'
import type {
  EntryCandidatePlan,
  EntryPlanner,
  EntryQueryConstraints,
  EntryQueryOptions,
  EntryQueryPlan
} from './EntryPlanner.js'
import {
  createQueryTrace,
  emptyQueryTrace,
  traceIndex
} from './QueryTrace.js'

export class SnapshotEntryPlanner implements EntryPlanner {
  readonly #snapshot: EntrySnapshot
  readonly #rowIdsByNode = new Map<EntryNodeId, Array<EntryRowId>>()

  constructor(snapshot: EntrySnapshot) {
    this.#snapshot = snapshot
    for (const version of snapshot.rows.versions) {
      const rowIds = this.#rowIdsByNode.get(version.nodeId) ?? []
      rowIds.push(version.rowId)
      this.#rowIdsByNode.set(version.nodeId, rowIds)
    }
  }

  candidates(
    plan: EntryQueryPlan,
    options: EntryQueryOptions = {}
  ): EntryCandidatePlan {
    let trace = options.trace
      ? emptyQueryTrace(this.#snapshot.graphSha)
      : undefined
    let candidates: Array<EntryRowId> | undefined

    const apply = (
      indexName: string,
      values: ReadonlyArray<string | null>,
      rowIds: Array<EntryRowId>
    ) => {
      for (const value of values) {
        if (trace) trace = traceIndex(trace, indexKey(indexName, value))
      }
      candidates = intersectCandidates(candidates, rowIds)
    }

    const constraints = plan.constraints
    if (constraints) {
      for (const [name, values, rowIds] of this.#constraintIndexes(
        constraints
      )) {
        apply(name, values, rowIds)
      }
      if (constraints.search) {
        if (trace)
          trace = traceIndex(trace, indexKey('search', constraints.search))
      }
    }

    if (plan.preFilter?.rowIds) {
      candidates = intersectCandidates(
        candidates,
        Array.from(plan.preFilter.rowIds)
      )
    }
    if (plan.preFilter?.nodeIds) {
      candidates = intersectCandidates(
        candidates,
        Array.from(plan.preFilter.nodeIds).flatMap(
          nodeId => this.#rowIdsByNode.get(nodeId) ?? []
        )
      )
    }
    if (plan.preFilter?.indexKeys && trace) {
      for (const key of plan.preFilter.indexKeys) trace = traceIndex(trace, key)
    }

    candidates ??= this.#snapshot.rows.versions.map(version => version.rowId)
    if (trace) {
      if (!constraints && !plan.preFilter) trace = traceIndex(trace, 'all')
      return {
        rowIds: candidates,
        trace: createQueryTrace({
          graphSha: trace.graphSha,
          rows: candidates,
          indexes: trace.indexes
        })
      }
    }
    return {rowIds: candidates}
  }

  *#constraintIndexes(
    constraints: EntryQueryConstraints
  ): Generator<
    [name: string, values: Array<string | null>, rows: Array<EntryRowId>]
  > {
    if (constraints.id)
      yield this.#fromMultiIndex(
        'id',
        valuesOf(constraints.id),
        this.#snapshot.indexes.byId
      )
    if (constraints.type)
      yield this.#fromMultiIndex(
        'type',
        valuesOf(constraints.type),
        this.#snapshot.indexes.byType
      )
    if (constraints.workspace)
      yield this.#fromMultiIndex(
        'workspace',
        valuesOf(constraints.workspace),
        this.#snapshot.indexes.byWorkspace
      )
    if (constraints.root)
      yield this.#fromMultiIndex(
        'root',
        valuesOf(constraints.root),
        this.#snapshot.indexes.byRoot
      )
    if (constraints.locale !== undefined)
      yield this.#fromMultiIndex(
        'locale',
        valuesOf(constraints.locale),
        this.#snapshot.indexes.byLocale
      )
    if (constraints.status)
      yield this.#fromMultiIndex(
        'status',
        valuesOf(constraints.status),
        this.#snapshot.indexes.byStatus
      )
    if (constraints.parentId !== undefined)
      yield this.#fromMultiIndex(
        'parent',
        valuesOf(constraints.parentId),
        this.#snapshot.indexes.byParent
      )
    if (constraints.filePath)
      yield this.#fromSingleIndex(
        'filePath',
        valuesOf(constraints.filePath),
        this.#snapshot.indexes.byFilePath
      )
    if (constraints.dir)
      yield this.#fromDirIndex(valuesOf(constraints.dir))
  }

  #fromMultiIndex(
    name: string,
    values: Array<string | null>,
    index: Record<string, Array<EntryRowId>>
  ): [name: string, values: Array<string | null>, rows: Array<EntryRowId>] {
    if (values.length === 1)
      return [name, values, index[indexValue(values[0])] ?? []]
    return [
      name,
      values,
      unique(values.flatMap(value => index[indexValue(value)] ?? []))
    ]
  }

  #fromSingleIndex(
    name: string,
    values: Array<string | null>,
    index: Record<string, EntryRowId>
  ): [name: string, values: Array<string | null>, rows: Array<EntryRowId>] {
    return [
      name,
      values,
      unique(values.flatMap(value => index[indexValue(value)] ?? []))
    ]
  }

  #fromDirIndex(
    values: Array<string | null>
  ): [name: string, values: Array<string | null>, rows: Array<EntryRowId>] {
    const nodeIds = values
      .map(value => (value ?? NULL_INDEX_VALUE))
      .map(value => this.#snapshot.indexes.byDir[value])
      .filter(Boolean)
    return [
      'dir',
      values,
      unique(nodeIds.flatMap(nodeId => this.#rowIdsByNode.get(nodeId) ?? []))
    ]
  }
}

function valuesOf<T extends string>(
  value: T | null | ReadonlyArray<T | null>
): Array<T | null> {
  if (Array.isArray(value)) return Array.from(value)
  return [value as T | null]
}

function intersectCandidates(
  current: Array<EntryRowId> | undefined,
  next: Array<EntryRowId>
): Array<EntryRowId> {
  if (!current) return next
  const allowed = new Set(next)
  return current.filter(rowId => allowed.has(rowId))
}

function unique<T>(values: Array<T>): Array<T> {
  return Array.from(new Set(values))
}
