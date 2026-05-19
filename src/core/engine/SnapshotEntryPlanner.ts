import type {EntrySnapshot} from './EntrySnapshot.js'
import {indexKey, indexValue, NULL_INDEX_VALUE} from './EntrySnapshotIndex.js'
import type {
  EntryLanguageRow,
  EntryNodeId,
  EntryNodeRow,
  EntryRowId,
  EntryVersionRow
} from './EntryRows.js'
import type {
  EntryCandidatePlan,
  EntryPlanner,
  EntryQueryConstraints,
  EntryQueryOptions,
  EntryQueryPlan
} from './EntryPlanner.js'
import {createQueryTrace, emptyQueryTrace, traceIndex} from './QueryTrace.js'

export class SnapshotEntryPlanner implements EntryPlanner {
  readonly #snapshot: EntrySnapshot
  readonly #rowIdsByNode = new Map<EntryNodeId, Array<EntryRowId>>()
  readonly #versions = new Map<EntryRowId, EntryVersionRow>()
  readonly #languages = new Map<string, EntryLanguageRow>()
  readonly #nodes = new Map<EntryNodeId, EntryNodeRow>()

  constructor(snapshot: EntrySnapshot) {
    this.#snapshot = snapshot
    for (const language of snapshot.rows.languages) {
      this.#languages.set(language.languageId, language)
    }
    for (const node of snapshot.rows.nodes) {
      this.#nodes.set(node.nodeId, node)
    }
    for (const version of snapshot.rows.versions) {
      this.#versions.set(version.rowId, version)
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
      candidates =
        candidates &&
        candidates.length <= 64 &&
        candidates.length <= rowIds.length
          ? candidates.filter(rowId =>
              this.#rowMatchesIndex(rowId, indexName, values)
            )
          : intersectCandidates(candidates, rowIds)
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
    if (constraints.active)
      yield ['active', ['true'], this.#snapshot.indexes.byActive]
    if (constraints.main)
      yield ['main', ['true'], this.#snapshot.indexes.byMain]
    if (constraints.parentId !== undefined)
      yield this.#fromMultiIndex(
        'parent',
        valuesOf(constraints.parentId),
        this.#snapshot.indexes.byParent
      )
    if (constraints.path)
      yield this.#fromMultiIndex(
        'path',
        valuesOf(constraints.path),
        this.#snapshot.indexes.byPath
      )
    if (constraints.url)
      yield this.#fromMultiIndex(
        'url',
        valuesOf(constraints.url),
        this.#snapshot.indexes.byUrl
      )
    if (constraints.level !== undefined)
      yield this.#fromMultiIndex(
        'level',
        valuesOf(constraints.level).map(String),
        this.#snapshot.indexes.byLevel
      )
    if (constraints.filePath)
      yield this.#fromSingleIndex(
        'filePath',
        valuesOf(constraints.filePath),
        this.#snapshot.indexes.byFilePath
      )
    if (constraints.dir) yield this.#fromDirIndex(valuesOf(constraints.dir))
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
      .map(value => value ?? NULL_INDEX_VALUE)
      .map(value => this.#snapshot.indexes.byDir[value])
      .filter(Boolean)
    return [
      'dir',
      values,
      unique(nodeIds.flatMap(nodeId => this.#rowIdsByNode.get(nodeId) ?? []))
    ]
  }

  #rowMatchesIndex(
    rowId: EntryRowId,
    indexName: string,
    values: ReadonlyArray<string | null>
  ) {
    const version = this.#versions.get(rowId)
    if (!version) return false
    const language = this.#languages.get(version.languageId)
    const node = this.#nodes.get(version.nodeId)
    const allowed = new Set(values.map(value => indexValue(value)))
    switch (indexName) {
      case 'id':
        return allowed.has(version.id)
      case 'type':
        return allowed.has(version.type)
      case 'workspace':
        return allowed.has(version.workspace)
      case 'root':
        return allowed.has(version.root)
      case 'locale':
        return allowed.has(indexValue(version.locale))
      case 'status':
        return allowed.has(language?.inheritedStatus ?? version.status)
      case 'active':
        return language?.activeRowId === version.rowId
      case 'main':
        return language?.mainRowId === version.rowId
      case 'parent':
        return allowed.has(indexValue(node?.parentId))
      case 'path':
        return allowed.has(version.path)
      case 'url':
        return Boolean(language && allowed.has(language.url))
      case 'level':
        return allowed.has(String(version.level))
      case 'filePath':
        return allowed.has(version.filePath)
      case 'dir':
        return Boolean(language && allowed.has(language.selfDir))
    }
    return false
  }
}

function valuesOf<T extends string | number>(
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
  const allowed = setOf(next)
  return current.filter(rowId => allowed.has(rowId))
}

const rowIdSets = new WeakMap<Array<EntryRowId>, Set<EntryRowId>>()

function setOf(rowIds: Array<EntryRowId>): Set<EntryRowId> {
  let set = rowIdSets.get(rowIds)
  if (!set) {
    set = new Set(rowIds)
    rowIdSets.set(rowIds, set)
  }
  return set
}

function unique<T>(values: Array<T>): Array<T> {
  return Array.from(new Set(values))
}
