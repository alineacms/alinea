import MiniSearch from 'minisearch'
import type {EntryStatus} from '../Entry.js'
import type {Entry} from '../Entry.js'
import type {Config} from '../Config.js'
import type {Expr} from '../Expr.js'
import {Field} from '../Field.js'
import type {
  EdgeQuery,
  GraphQuery,
  Order,
  Projection,
  Status
} from '../Graph.js'
import {querySource} from '../Graph.js'
import {getExpr, hasExpr, hasField} from '../Internal.js'
import {getScope, type Scope} from '../Scope.js'
import {compileEntryFilter} from './EntryFilter.js'
import type {
  EntryQueryConstraints,
  EntryQueryOptions,
  EntryQueryPlan,
  TracedEntryQueryResult
} from './RxbEntryPlanner.js'
import {createQueryTrace, mergeQueryTraces} from './QueryTrace.js'
import type {
  RxbEntryArtifact,
  RxbEntryColumnName,
  RxbEntryRow
} from './RxbEntryArtifact.js'
import {
  decodeRxbEntryArtifact,
  RxbEntryArtifactCursor,
  rxbEntryColumnNames,
  rxbEntryIsActive,
  rxbEntryIsMain,
  rxbEntryStatusFromFlags
} from './RxbEntryArtifact.js'
import {RxbEntryPlanner} from './RxbEntryPlanner.js'

export interface RxbEntryEngineOptions {
  config: Config
  artifact: RxbEntryArtifact
  bytes?: Uint8Array
  leafCacheSize?: number
  planCacheSize?: number
  rowCacheSize?: number
  entryCacheSize?: number
}

export interface OpenRxbEntryEngineOptions {
  leafCacheSize?: number
  planCacheSize?: number
  rowCacheSize?: number
  entryCacheSize?: number
}

export class RxbEntryEngine {
  readonly #artifact: RxbEntryArtifact
  readonly #planner: RxbEntryPlanner
  readonly #scope: Scope
  readonly #cursor: RxbEntryArtifactCursor | undefined
  readonly #entryCacheSize: number
  readonly #entries = new Map<string, Entry>()
  #searchIndex: MiniSearch | undefined
  #rowOrdinals: Map<string, number> | undefined
  #allRows: Array<RxbEntryRow> | undefined
  #rowsById: Map<string, Array<RxbEntryRow>> | undefined
  #rowsByParentId: Map<string, Array<RxbEntryRow>> | undefined
  readonly #ordinalCache = new WeakMap<Array<string>, Array<number>>()
  readonly #columnCache = new Map<RxbEntryColumnName, Array<unknown>>()
  #flags: Array<number> | undefined
  #sparseFlagReads = 0

  constructor(options: RxbEntryEngineOptions) {
    this.#artifact = options.artifact
    this.#scope = getScope(options.config)
    this.#planner = new RxbEntryPlanner(options.config, options.artifact, {
      bytes: options.bytes,
      leafCacheSize: options.leafCacheSize,
      planCacheSize: options.planCacheSize,
      rowCacheSize: options.rowCacheSize
    })
    this.#cursor = options.bytes
      ? new RxbEntryArtifactCursor(options.bytes)
      : undefined
    this.#entryCacheSize = options.entryCacheSize ?? 512
  }

  get graphSha() {
    return this.#artifact.meta.graphSha
  }

  get artifact() {
    return this.#artifact
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
    const unsupported = unsupportedRxbEntryQueryReason(plan.query)
    if (unsupported)
      throw new Error(`Unsupported RXB engine query: ${unsupported}`)

    const constraints =
      plan.constraints ?? compileRxbEntryQueryConstraints(plan.query)
    const candidatePlan = this.#planner.candidateRowIds(
      {...plan, constraints},
      options
    )
    const query = plan.query as GraphQuery<Projection>
    const predicate = isRxbFilterFullyIndexed(query.filter)
      ? undefined
      : compileEntryFilter(query.filter, readRowField)
    let rowIds = candidatePlan.rowIds
    if (query.search) rowIds = this.#searchRowIds(query.search, rowIds)
    if (predicate) {
      rowIds = this.#planner
        .rowsForIds(rowIds)
        .filter(row => predicate(row))
        .map(row => row.rowId)
    }
    const orderByRowId = query.orderBy && canOrderByRowId(query.orderBy)
    if (orderByRowId) this.#orderRowIds(rowIds, query.orderBy!)
    if (
      !options?.trace &&
      !query.count &&
      !query.groupBy &&
      (!query.orderBy || orderByRowId)
    ) {
      const windowedRowIds = windowRowIds(rowIds, query)
      const value = this.#projectRowIds(
        windowedRowIds,
        query,
        query.status ?? 'published'
      ) as Value
      await this.#postProcessResult(query, value, windowedRowIds)
      return value
    }
    let rows =
      query.count && !query.groupBy && !query.orderBy
        ? []
        : this.#planner.rowsForIds(rowIds)

    if (query.groupBy && !Array.isArray(query.groupBy))
      rows = groupRows(rows, query.groupBy)
    if (query.orderBy && !orderByRowId) orderRows(rows, query.orderBy)

    if (query.skip) {
      if (query.count && !query.groupBy) rowIds = rowIds.slice(query.skip)
      else rows.splice(0, query.skip)
    }
    if (query.take) {
      if (query.count && !query.groupBy) rowIds = rowIds.slice(0, query.take)
      else rows.splice(query.take)
    }
    if (!(query.count && !query.groupBy)) rowIds = rows.map(row => row.rowId)

    const value = (
      query.count
        ? query.groupBy
          ? rows.length
          : rowIds.length
        : query.get
          ? this.#projectRow(
              rows[0],
              query.select,
              rowIds[0],
              query.status ?? 'published'
            )
          : query.first
            ? rowIds[0]
              ? this.#projectRow(
                  rows[0],
                  query.select,
                  rowIds[0],
                  query.status ?? 'published'
                )
              : null
            : rows.map(row =>
                this.#projectRow(
                  row,
                  query.select,
                  row.rowId,
                  query.status ?? 'published'
                )
              )
    ) as Value
    await this.#postProcessResult(query, value, rowIds)

    if (options?.trace) {
      return {
        value,
        trace: mergeQueryTraces(
          candidatePlan.trace,
          createQueryTrace({
            graphSha: this.graphSha,
            nodes: rows.map(row => row.id)
          })
        )
      }
    }
    return value
  }

  #entryForRow(row: RxbEntryRow): Entry {
    const cached = this.#entries.get(row.rowId)
    if (cached) return cached
    const {
      rowId: _rowId,
      versionId: _versionId,
      nodeId: _nodeId,
      languageId: _languageId,
      versionStatus: _versionStatus,
      ...entry
    } = row
    this.#entries.set(row.rowId, entry)
    if (this.#entries.size > this.#entryCacheSize) {
      const first = this.#entries.keys().next().value
      if (first) this.#entries.delete(first)
    }
    return entry
  }

  #searchRowIds(search: string | Array<string>, candidates: Array<string>) {
    const terms = Array.isArray(search) ? search.join(' ') : search
    if (!terms) return candidates
    const allowed = new Set(candidates)
    return this.#search()
      .search(terms, {
        prefix: true,
        fuzzy: 0.1,
        boost: {title: 2},
        filter: result => allowed.has((result as any).rowId)
      })
      .map(result => (result as any).rowId as string)
  }

  #search(): MiniSearch {
    if (this.#searchIndex) return this.#searchIndex
    const search = new MiniSearch({
      fields: ['title', 'searchableText'],
      storeFields: ['rowId'],
      tokenize(text) {
        return text
          .normalize('NFD')
          .replace(DIACRITIC, '')
          .split(SPACE_OR_PUNCTUATION)
      }
    })
    for (const rowId of this.#artifact.payload.columns.rowIds) {
      const row = this.#planner.row(rowId)
      if (!row) continue
      search.add({
        id: rowId,
        rowId,
        title: row.title,
        searchableText: row.searchableText
      })
    }
    this.#searchIndex = search
    return search
  }

  #projectRow(
    row: RxbEntryRow | undefined,
    projection: Projection | undefined,
    rowId?: string,
    status: Status = 'published'
  ): unknown {
    if (!projection) {
      if (!row) return undefined
      return this.#entryForRow(row)
    }
    if (hasExpr(projection as any)) {
      const expr = getExpr(projection as any)
      if (expr.type === 'field') {
        if (!row) return undefined
        const value = this.#field(row, projection as Expr)
        return cloneProjectedValue(value)
      }
      if (expr.type !== 'entryField')
        throw new Error(`Unsupported RXB engine projection: ${expr.type}`)
      if (rowId) {
        const columnValue = this.#columnValue(
          rowId,
          expr.name as keyof RxbEntryRow
        )
        if (columnValue.found) return columnValue.value
      }
      if (!row) return undefined
      return row[expr.name as keyof RxbEntryRow]
    }
    if (querySource(projection))
      return this.#edgeQueryValue(
        row,
        projection as EdgeQuery<Projection>,
        status
      )
    return Object.fromEntries(
      Object.entries(projection as Record<string, Projection>).map(
        ([key, value]) => [key, this.#projectRow(row, value, rowId, status)]
      )
    )
  }

  #projectRowIds(
    rowIds: Array<string>,
    query: GraphQuery<Projection>,
    status: Status
  ): unknown {
    const edgeSingle = isEdgeSingleResult(query)
    if (!query.select) {
      if (query.get)
        return this.#projectRow(
          this.#planner.row(rowIds[0]),
          undefined,
          rowIds[0],
          status
        )
      if (query.first)
        return rowIds[0]
          ? this.#projectRow(
              this.#planner.row(rowIds[0]),
              undefined,
              rowIds[0],
              status
            )
          : null
      if (edgeSingle)
        return rowIds[0]
          ? this.#projectRow(
              this.#planner.row(rowIds[0]),
              undefined,
              rowIds[0],
              status
            )
          : undefined
      return rowIds.map(rowId =>
        this.#projectRow(this.#planner.row(rowId), undefined, rowId, status)
      )
    }
    if (query.get) {
      const ordinal = this.#rowOrdinal(rowIds[0])
      return ordinal === undefined
        ? undefined
        : this.#projectOrdinal(ordinal, query.select, status)
    }
    if (query.first) {
      const rowId = rowIds[0]
      const ordinal = rowId ? this.#rowOrdinal(rowId) : undefined
      return ordinal === undefined
        ? null
        : this.#projectOrdinal(ordinal, query.select, status)
    }
    if (edgeSingle) {
      const rowId = rowIds[0]
      const ordinal = rowId ? this.#rowOrdinal(rowId) : undefined
      return ordinal === undefined
        ? undefined
        : this.#projectOrdinal(ordinal, query.select, status)
    }
    const ordinals = this.#ordinalsForRowIds(rowIds)
    return ordinals.map(ordinal =>
      this.#projectOrdinal(ordinal, query.select, status)
    )
  }

  #columnValue(
    rowId: string,
    name: keyof RxbEntryRow
  ): {found: boolean; value: unknown} {
    if (name === 'data') return {found: false, value: undefined}
    const columns = this.#artifact.payload.columns
    if (!columns) return {found: false, value: undefined}
    const ordinal = this.#rowOrdinal(rowId)
    if (ordinal === undefined) return {found: false, value: undefined}
    if (name === 'rowId') return {found: true, value: rowId}
    const flagValue = this.#flagFieldValue(ordinal, name)
    if (flagValue.found) return flagValue
    if (!isRxbEntryColumnName(name)) {
      const row = this.#planner.row(rowId)
      return {found: Boolean(row), value: row?.[name]}
    }
    const values = this.#columnValues(name as RxbEntryColumnName)
    return {found: true, value: values[ordinal]}
  }

  #rowOrdinal(rowId: string): number | undefined {
    if (this.#rowOrdinals) return this.#rowOrdinals.get(rowId)
    const rowIds = Array.from(this.#artifact.payload.columns.rowIds)
    const ordinals = new Map<string, number>()
    for (let i = 0; i < rowIds.length; i++) ordinals.set(rowIds[i], i)
    this.#rowOrdinals = ordinals
    return ordinals.get(rowId)
  }

  #columnValues(name: RxbEntryColumnName): Array<unknown> {
    const cached = this.#columnCache.get(name)
    if (cached) return cached
    const values = Array.from(
      this.#artifact.payload.columns.values[name] as ReadonlyArray<unknown>
    )
    this.#columnCache.set(name, values)
    return values
  }

  #ordinalsForRowIds(rowIds: Array<string>): Array<number> {
    const cached = this.#ordinalCache.get(rowIds)
    if (cached) return cached
    const ordinals = rowIds
      .map(rowId => this.#rowOrdinal(rowId))
      .filter((ordinal): ordinal is number => ordinal !== undefined)
    this.#ordinalCache.set(rowIds, ordinals)
    return ordinals
  }

  #projectOrdinal(
    ordinal: number,
    projection: Projection | undefined,
    status: Status = 'published'
  ): unknown {
    if (!projection) {
      const rowId = this.#rowIdAt(ordinal)
      return this.#projectRow(this.#planner.row(rowId), undefined)
    }
    if (hasExpr(projection as any)) {
      const expr = getExpr(projection as any)
      if (expr.type === 'field') {
        const rowId = this.#rowIdAt(ordinal)
        const row = this.#planner.row(rowId)
        if (!row) return undefined
        const value = this.#field(row, projection as Expr)
        return cloneProjectedValue(value)
      }
      if (expr.type !== 'entryField')
        throw new Error(`Unsupported RXB engine projection: ${expr.type}`)
      if (expr.name === 'data') {
        const rowId = this.#rowIdAt(ordinal)
        return this.#planner.row(rowId)?.data
      }
      if (expr.name === 'rowId') return this.#rowIdAt(ordinal)
      const flagValue = this.#flagFieldValue(
        ordinal,
        expr.name as keyof RxbEntryRow
      )
      if (flagValue.found) return flagValue.value
      if (!isRxbEntryColumnName(expr.name)) {
        const rowId = this.#rowIdAt(ordinal)
        return this.#planner.row(rowId)?.[expr.name as keyof RxbEntryRow]
      }
      return this.#columnValues(expr.name as RxbEntryColumnName)[ordinal]
    }
    if (querySource(projection)) {
      const rowId = this.#rowIdAt(ordinal)
      return this.#projectRow(
        this.#planner.row(rowId),
        projection,
        rowId,
        status
      )
    }
    const rowId = this.#rowIdAt(ordinal)
    const row = this.#planner.row(rowId)
    return Object.fromEntries(
      Object.entries(projection as Record<string, Projection>).map(
        ([key, value]) => [key, this.#projectRow(row, value, rowId, status)]
      )
    )
  }

  #rowIdAt(ordinal: number): string {
    return this.#artifact.payload.columns.rowIds[ordinal]
  }

  #orderRowIds(rowIds: Array<string>, orderBy: Order | Array<Order>) {
    const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
    const sorters = orders.flatMap(order => {
      const expr = order.asc ?? order.desc
      if (!expr || !hasExpr(expr as any)) return []
      const internal = getExpr(expr as any)
      if (internal.type !== 'entryField') return []
      return [
        {
          field: internal.name as keyof RxbEntryRow,
          desc: Boolean(order.desc),
          caseSensitive: order.caseSensitive
        }
      ]
    })
    const ordinals = this.#ordinalsForRowIds(rowIds)
    ordinals.sort((a, b) => {
      for (const sorter of sorters) {
        const result = compareValues(
          this.#ordinalSortValue(a, sorter.field),
          this.#ordinalSortValue(b, sorter.field),
          sorter.caseSensitive
        )
        if (result !== 0) return sorter.desc ? -result : result
      }
      return 0
    })
    for (let index = 0; index < ordinals.length; index++) {
      rowIds[index] = this.#rowIdAt(ordinals[index])
    }
  }

  #ordinalSortValue(ordinal: number, name: keyof RxbEntryRow): unknown {
    if (name === 'rowId' || name === 'filePath') return this.#rowIdAt(ordinal)
    const flagValue = this.#flagFieldValue(ordinal, name)
    if (flagValue.found) return flagValue.value
    if (isRxbEntryColumnName(name))
      return this.#columnValues(name as RxbEntryColumnName)[ordinal]
    return this.#planner.row(this.#rowIdAt(ordinal))?.[name]
  }

  #field(row: RxbEntryRow, field: Expr): unknown {
    const name = this.#scope.nameOf(field)
    if (!name) throw new Error(`Expression has no name ${field}`)
    return row.data[name]
  }

  #edgeQueryValue(
    row: RxbEntryRow | undefined,
    query: EdgeQuery<Projection>,
    inheritedStatus: Status
  ): unknown {
    if (!row) return isEdgeSingleResult(query) ? undefined : []
    const rowIds = this.#edgeRowIds(row, query)
    const status = query.status ?? inheritedStatus
    const locale =
      query.edge === 'translations'
        ? query.locale
        : query.locale === undefined
          ? row.locale
          : query.locale
    return this.#queryRows(
      rowIds,
      locale === undefined ? {...query, status} : {...query, status, locale},
      status
    )
  }

  #queryRows(
    inputRowIds: Array<string>,
    query: GraphQuery<Projection>,
    status: Status
  ): unknown {
    const constraints = compileRxbEntryQueryConstraints(query)
    const candidatePlan = this.#planner.candidateRowIds({
      query,
      constraints,
      preFilter: {rowIds: inputRowIds}
    })
    const predicate = isRxbFilterFullyIndexed(query.filter)
      ? undefined
      : compileEntryFilter(query.filter, readRowField)
    let rowIds = candidatePlan.rowIds
    if (query.search) rowIds = this.#searchRowIds(query.search, rowIds)
    if (predicate) {
      rowIds = this.#planner
        .rowsForIds(rowIds)
        .filter(row => predicate(row))
        .map(row => row.rowId)
    }
    const orderByRowId = query.orderBy && canOrderByRowId(query.orderBy)
    if (orderByRowId) this.#orderRowIds(rowIds, query.orderBy!)
    if (!query.count && !query.groupBy && (!query.orderBy || orderByRowId)) {
      return this.#projectRowIds(windowRowIds(rowIds, query), query, status)
    }
    let rows =
      query.count && !query.groupBy && !query.orderBy
        ? []
        : this.#planner.rowsForIds(rowIds)

    if (query.groupBy && !Array.isArray(query.groupBy))
      rows = groupRows(rows, query.groupBy)
    if (query.orderBy && !orderByRowId) orderRows(rows, query.orderBy)
    else if (querySource(query) === 'parents') {
      rows.sort((a, b) => a.level - b.level)
    }

    if (query.skip) {
      if (query.count && !query.groupBy) rowIds = rowIds.slice(query.skip)
      else rows.splice(0, query.skip)
    }
    if (query.take) {
      if (query.count && !query.groupBy) rowIds = rowIds.slice(0, query.take)
      else rows.splice(query.take)
    }
    if (!(query.count && !query.groupBy)) rowIds = rows.map(row => row.rowId)

    if (query.count) return query.groupBy ? rows.length : rowIds.length
    if (query.get || query.first || isEdgeSingleResult(query))
      return rowIds[0]
        ? this.#projectRow(rows[0], query.select, rowIds[0], status)
        : query.first
          ? null
          : undefined
    return rows.map(row => this.#projectRow(row, query.select, row.rowId, status))
  }

  #edgeRowIds(row: RxbEntryRow, query: EdgeQuery): Array<string> {
    switch (query.edge) {
      case 'parent':
        return row.parentId
          ? this.#rowsForEntryId(row.parentId, row.locale).map(row => row.rowId)
          : []
      case 'next':
      case 'previous': {
        const sibling = this.#adjacentSibling(row, query.edge)
        return sibling
          ? this.#rowsForEntryId(sibling.id, row.locale).map(row => row.rowId)
          : []
      }
      case 'siblings':
        if (!row.parentId) return []
        return this.#rowsForParentId(row.parentId)
          .filter(sibling => {
            if (sibling.locale !== row.locale) return false
            return query.includeSelf || sibling.id !== row.id
          })
          .map(sibling => sibling.rowId)
      case 'translations':
        return this.#rowsForEntryId(row.id)
          .filter(translation => {
            return query.includeSelf || translation.locale !== row.locale
          })
          .map(translation => translation.rowId)
      case 'children': {
        const depth = query.depth ?? 1
        return this.#allEntryRows()
          .filter(child => {
            return (
              child.filePath.startsWith(row.childrenDir) &&
              child.level > row.level &&
              child.level <= row.level + depth
            )
          })
          .map(child => child.rowId)
      }
      case 'parents': {
        const depth = query.depth ?? Number.POSITIVE_INFINITY
        const parentIds = row.parents.slice(-depth)
        return parentIds.flatMap(id =>
          this.#rowsForEntryId(id, row.locale).map(parent => parent.rowId)
        )
      }
      case 'entryMultiple': {
        const value = this.#field(row, query.field)
        if (!Array.isArray(value)) return []
        return value.flatMap(item => {
          const id = isRecord(item) ? item._entry : undefined
          return typeof id === 'string'
            ? this.#rowsForEntryId(id).map(entry => entry.rowId)
            : []
        })
      }
      case 'entrySingle': {
        const value = this.#field(row, query.field)
        const id = isRecord(value) ? value._entry : undefined
        return typeof id === 'string'
          ? this.#rowsForEntryId(id).map(entry => entry.rowId)
          : []
      }
      default:
        return []
    }
  }

  #adjacentSibling(
    row: RxbEntryRow,
    direction: 'next' | 'previous'
  ): RxbEntryRow | undefined {
    if (!row.parentId) return
    const seen = new Set<string>()
    const siblings = this.#rowsForParentId(row.parentId)
      .filter(sibling => sibling.locale === row.locale && sibling.main)
      .filter(sibling => {
        if (seen.has(sibling.id)) return false
        seen.add(sibling.id)
        return true
      })
      .sort((a, b) => compareValues(a.index, b.index, false))
    const index = siblings.findIndex(sibling => sibling.id === row.id)
    if (index === -1) return
    return direction === 'next' ? siblings[index + 1] : siblings[index - 1]
  }

  #allEntryRows(): Array<RxbEntryRow> {
    if (this.#allRows) return this.#allRows
    this.#allRows = this.#planner.rowsForIds(
      Array.from(this.#artifact.payload.columns.rowIds)
    )
    return this.#allRows
  }

  #rowsForEntryId(
    id: string,
    locale?: string | null
  ): Array<RxbEntryRow> {
    if (!this.#rowsById) {
      this.#rowsById = new Map()
      for (const row of this.#allEntryRows()) {
        const rows = this.#rowsById.get(row.id) ?? []
        rows.push(row)
        this.#rowsById.set(row.id, rows)
      }
    }
    const rows = this.#rowsById.get(id) ?? []
    return locale === undefined
      ? rows
      : rows.filter(row => row.locale === locale)
  }

  #rowsForParentId(parentId: string): Array<RxbEntryRow> {
    if (!this.#rowsByParentId) {
      this.#rowsByParentId = new Map()
      for (const row of this.#allEntryRows()) {
        if (!row.parentId) continue
        const rows = this.#rowsByParentId.get(row.parentId) ?? []
        rows.push(row)
        this.#rowsByParentId.set(row.parentId, rows)
      }
    }
    return this.#rowsByParentId.get(parentId) ?? []
  }

  async #postProcessResult(
    query: GraphQuery<Projection>,
    value: unknown,
    rowIds: Array<string>
  ) {
    if (query.count || !query.select) return
    if (!projectionHasField(query.select)) return
    if (query.get || query.first) {
      if (value)
        await this.#postProcessRow(
          query.select,
          value,
          rowIds[0],
          query.status ?? 'published'
        )
      return
    }
    if (!Array.isArray(value)) return
    await Promise.all(
      value.map((row, index) =>
        row
          ? this.#postProcessRow(
              query.select!,
              row,
              rowIds[index],
              query.status ?? 'published'
            )
          : undefined
      )
    )
  }

  async #postProcessRow(
    projection: Projection,
    value: unknown,
    rowId: string | undefined,
    status: Status
  ) {
    if (!rowId) return
    const row = this.#planner.row(rowId)
    const linkResolver = new RxbLinkResolver(
      this,
      row?.locale ?? null,
      status
    )
    await this.#postProcessProjection(projection, value, linkResolver)
  }

  async #postProcessProjection(
    projection: Projection,
    value: unknown,
    linkResolver: RxbLinkResolver
  ): Promise<void> {
    if (!value) return
    if (hasExpr(projection as any)) {
      if (hasField(projection as any))
        await Field.shape(projection as any).applyLinks(value, linkResolver as any)
      return
    }
    if (isRecord(projection) && querySource(projection)) {
      await this.#postProcessEdgeProjection(
        projection as EdgeQuery<Projection>,
        value,
        linkResolver
      )
      return
    }
    if (!isRecord(projection)) return
    await Promise.all(
      Object.entries(projection).map(([key, nextProjection]) => {
        const nextValue = (value as Record<string, unknown>)[key]
        return this.#postProcessProjection(
          nextProjection as Projection,
          nextValue,
          linkResolver
        )
      })
    )
  }

  #flagFieldValue(
    ordinal: number,
    name: keyof RxbEntryRow
  ): {found: boolean; value: unknown} {
    const flags = this.#flagAt(ordinal)
    switch (name) {
      case 'active':
        return {found: true, value: rxbEntryIsActive(flags)}
      case 'main':
        return {found: true, value: rxbEntryIsMain(flags)}
      case 'status':
      case 'versionStatus':
        return {found: true, value: rxbEntryStatusFromFlags(flags)}
      default:
        return {found: false, value: undefined}
    }
  }

  #flagAt(ordinal: number): number {
    if (this.#flags) return this.#flags[ordinal]
    if (this.#cursor && this.#sparseFlagReads++ < 64) {
      const value = this.#cursor.flagAt(ordinal)
      if (value !== undefined) return value
    }
    this.#flags = Array.from(this.#artifact.payload.columns.flags)
    return this.#flags[ordinal]
  }

  async #postProcessEdgeProjection(
    projection: EdgeQuery<Projection>,
    value: unknown,
    linkResolver: RxbLinkResolver
  ): Promise<void> {
    if (projection.count || !projection.select) return
    if (isEdgeSingleResult(projection)) {
      if (value)
        await this.#postProcessProjection(
          projection.select,
          value,
          linkResolver
        )
      return
    }
    if (!Array.isArray(value)) return
    await Promise.all(
      value.map(row =>
        row
          ? this.#postProcessProjection(projection.select!, row, linkResolver)
          : undefined
      )
    )
  }
}

const rxbEntryColumnNameSet = new Set<string>(rxbEntryColumnNames)
const DIACRITIC = /[\u0300-\u036f]/g
const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u

class RxbLinkResolver {
  readonly #engine: RxbEntryEngine
  readonly #locale: string | null
  readonly #status: Status

  constructor(
    engine: RxbEntryEngine,
    locale: string | null,
    status: Status
  ) {
    this.#engine = engine
    this.#locale = locale
    this.#status = status
  }

  includedAtBuild(filePath: string): boolean {
    return Boolean(this.#engine.artifact.payload.tree.tree.find(entry => entry.path === filePath))
  }

  resolveLinks<P extends Projection>(
    projection: P,
    entryIds: ReadonlyArray<string>
  ): Promise<Array<unknown>> {
    return this.#engine.query({
      query: {
        preferredLocale: this.#locale ?? undefined,
        status: this.#status,
        select: projection,
        id: {in: entryIds}
      } as GraphQuery<Projection>
    }) as Promise<Array<unknown>>
  }
}

function isRxbEntryColumnName(name: unknown): name is RxbEntryColumnName {
  return typeof name === 'string' && rxbEntryColumnNameSet.has(name)
}

function cloneProjectedValue(value: unknown): unknown {
  if (value && typeof value === 'object') {
    try {
      return structuredClone(value)
    } catch {
      return JSON.parse(JSON.stringify(value))
    }
  }
  return value
}

function projectionHasField(projection: Projection | undefined): boolean {
  if (!projection) return false
  if (hasExpr(projection as any)) return hasField(projection as any)
  if (isRecord(projection) && querySource(projection))
    return projectionHasField((projection as EdgeQuery<Projection>).select)
  if (!isRecord(projection)) return false
  return Object.values(projection).some(value =>
    projectionHasField(value as Projection)
  )
}

export function openRxbEntryEngine(
  config: Config,
  buffer: Uint8Array,
  options: OpenRxbEntryEngineOptions = {}
): RxbEntryEngine {
  return new RxbEntryEngine({
    config,
    artifact: decodeRxbEntryArtifact(buffer),
    bytes: buffer,
    ...options
  })
}

export function compileRxbEntryQueryConstraints(
  query: GraphQuery
): EntryQueryConstraints | undefined {
  const unsupported = unsupportedRxbEntryQueryReason(query)
  if (unsupported)
    throw new Error(`Unsupported RXB engine query: ${unsupported}`)

  const constraints: EntryQueryConstraints = {}
  const id = stringValues(query.id)
  if (id) constraints.id = id
  const parentId = nullableStringValues(query.parentId)
  if (parentId !== undefined) constraints.parentId = parentId
  const path = stringValues(query.path)
  if (path) constraints.path = path
  const url = stringValues(query.url)
  if (url) constraints.url = url
  const level = numberValues(query.level)
  if (level !== undefined) constraints.level = level
  const workspace = stringValues(query.workspace)
  if (workspace) constraints.workspace = workspace
  const root = stringValues(query.root)
  if (root) constraints.root = root
  if (query.locale !== undefined) {
    constraints.locale = query.locale
  } else if (query.preferredLocale) {
    constraints.locale = [query.preferredLocale.toLowerCase(), null]
  }
  const type = stringValues(query.type)
  if (type) constraints.type = type
  if (query.search) {
    constraints.search = Array.isArray(query.search)
      ? query.search.join(' ')
      : query.search
  }
  applyStatusConstraint(constraints, query.status)

  return Object.keys(constraints).length > 0 ? constraints : undefined
}

export function unsupportedRxbEntryQueryReason(
  query: GraphQuery
): string | undefined {
  if (query.select) {
    const reason = unsupportedEntryProjectionReason(query.select as Projection)
    if (reason) return `projection ${reason}`
  }
  if (query.include) return 'include'
  if (query.location) return 'location'
  if (query.orderBy) {
    const reason = unsupportedEntryOrderReason(query.orderBy)
    if (reason) return `orderBy ${reason}`
  }
  if (query.groupBy) {
    const reason = unsupportedEntryGroupReason(query.groupBy)
    if (reason) return `groupBy ${reason}`
  }
  if (query.preview) return 'preview'
  if (query.type && !stringValues(query.type)) return 'non-string type'
  if (query.workspace && !stringValues(query.workspace))
    return 'non-string workspace'
  if (query.root && !stringValues(query.root)) return 'non-string root'
  if (
    query.status &&
    query.status !== 'all' &&
    query.status !== 'preferDraft' &&
    query.status !== 'preferPublished' &&
    !statusValues(query.status)
  )
    return `status "${query.status}"`
}

function readRowField(row: RxbEntryRow, name: string): unknown {
  const entryField = ENTRY_FIELD_ALIASES[name]
  if (entryField) return row[entryField]
  if (name in row) return row[name as keyof RxbEntryRow]
  return row.data[name]
}

function unsupportedEntryProjectionReason(
  projection: Projection | undefined
): string | undefined {
  if (!projection) return
  if (hasExpr(projection as any)) {
    const expr = getExpr(projection as any)
    if (expr.type === 'field') return
    if (expr.type === 'entryField') return
    return expr.type
  }
  if (!isRecord(projection)) return 'non-object projection'
  if (querySource(projection)) {
    const reason = unsupportedRxbEntryQueryReason(
      projection as EdgeQuery<Projection>
    )
    return reason ? `edge ${reason}` : undefined
  }
  for (const value of Object.values(projection)) {
    const reason = unsupportedEntryProjectionReason(value as Projection)
    if (reason) return reason
  }
}

function unsupportedEntryOrderReason(
  orderBy: Order | Array<Order> | undefined
): string | undefined {
  if (!orderBy) return
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  for (const order of orders) {
    const expr = order.asc ?? order.desc
    if (!expr) return 'missing expression'
    if (!hasExpr(expr as any)) return 'non-expression'
    const internal = getExpr(expr as any)
    if (internal.type !== 'entryField') return internal.type
  }
}

function unsupportedEntryGroupReason(
  groupBy: Expr | Array<Expr> | undefined
): string | undefined {
  if (!groupBy) return
  if (Array.isArray(groupBy)) return 'multiple fields'
  if (!hasExpr(groupBy as any)) return 'non-expression'
  const internal = getExpr(groupBy as any)
  if (internal.type !== 'entryField') return internal.type
}

function canOrderByRowId(orderBy: Order | Array<Order> | undefined): boolean {
  if (!orderBy) return false
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  return orders.every(order => {
    const expr = order.asc ?? order.desc
    return Boolean(
      expr && hasExpr(expr as any) && getExpr(expr as any).type === 'entryField'
    )
  })
}

function isEdgeSingleResult(query: GraphQuery & Partial<EdgeQuery>): boolean {
  return Boolean(
    query.edge === 'parent' || query.edge === 'next' || query.edge === 'previous'
  )
}

function windowRowIds(
  rowIds: Array<string>,
  query: Pick<GraphQuery, 'skip' | 'take'>
): Array<string> {
  if (!query.skip && !query.take) return rowIds
  const start = query.skip ?? 0
  const end = query.take ? start + query.take : undefined
  return rowIds.slice(start, end)
}

function orderRows(rows: Array<RxbEntryRow>, orderBy: Order | Array<Order>) {
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  rows.sort((a, b) => {
    for (const order of orders) {
      const expr = order.asc ?? order.desc
      if (!expr || !hasExpr(expr as any)) continue
      const internal = getExpr(expr as any)
      if (internal.type !== 'entryField') continue
      const result = compareValues(
        a[internal.name as keyof RxbEntryRow],
        b[internal.name as keyof RxbEntryRow],
        order.caseSensitive
      )
      if (result !== 0) return order.asc ? result : -result
    }
    return 0
  })
}

function groupRows(
  rows: Array<RxbEntryRow>,
  groupBy: Expr
): Array<RxbEntryRow> {
  const groups = new Map<unknown, RxbEntryRow>()
  const internal = getExpr(groupBy as any)
  for (const row of rows) {
    const value =
      internal.type === 'entryField'
        ? row[internal.name as keyof RxbEntryRow]
        : undefined
    if (!groups.has(value)) groups.set(value, row)
  }
  return Array.from(groups.values())
}

function compareValues(
  a: unknown,
  b: unknown,
  caseSensitive: boolean | undefined
) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string') {
    return (caseSensitive ? CASE_SENSITIVE_COLLATOR : NATURAL_COLLATOR).compare(
      a,
      b
    )
  }
  return 0
}

const NATURAL_COLLATOR = new Intl.Collator(undefined, {numeric: true})
const CASE_SENSITIVE_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'variant'
})

function isRxbFilterFullyIndexed(filter: unknown): boolean {
  if (!filter) return true
  if (!isRecord(filter)) return false
  if (isOnlyFilterKey(filter, 'and'))
    return filter.and.filter(Boolean).every(isRxbFilterFullyIndexed)
  if (isOnlyFilterKey(filter, 'or'))
    return filter.or.filter(Boolean).every(isRxbFilterFullyIndexed)
  return Object.values(filter).every(isRxbFieldConditionFullyIndexed)
}

function isRxbFieldConditionFullyIndexed(condition: unknown): boolean {
  if (isPrimitiveIndexValue(condition)) return true
  if (!isRecord(condition)) return false
  for (const key of Object.keys(condition)) {
    switch (key) {
      case 'is':
        if (!isPrimitiveIndexValue(condition.is)) return false
        break
      case 'in':
        if (
          !Array.isArray(condition.in) ||
          !condition.in.every(isPrimitiveIndexValue)
        )
          return false
        break
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        if (typeof condition[key] !== 'number') return false
        break
      case 'has':
      case 'includes':
        if (!isRxbFilterFullyIndexed(condition[key])) return false
        break
      default:
        return false
    }
  }
  return true
}

function isPrimitiveIndexValue(
  value: unknown
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isOnlyFilterKey<T extends string>(
  input: object,
  key: T
): input is Record<T, Array<unknown>> {
  const keys = Object.keys(input)
  return keys.length === 1 && keys[0] === key
}

function stringValues(input: unknown): string | Array<string> | undefined {
  if (typeof input === 'string') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(value => typeof value === 'string')
    if (values.length > 0) return values
  }
}

function nullableStringValues(
  input: unknown
): string | null | Array<string | null> | undefined {
  if (input === null || typeof input === 'string') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(
      value => value === null || typeof value === 'string'
    )
    if (values.length > 0) return values
  }
}

function numberValues(input: unknown): number | Array<number> | undefined {
  if (typeof input === 'number') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(value => typeof value === 'number')
    if (values.length > 0) return values
  }
}

function statusValues(
  input: Status | undefined
): EntryStatus | Array<EntryStatus> | undefined {
  if (!input) return undefined
  if (Array.isArray(input)) {
    const values = input.filter(isExactStatus)
    if (values.length === input.length) return values
    return
  }
  if (isExactStatus(input)) return input
}

function applyStatusConstraint(
  constraints: EntryQueryConstraints,
  input: Status | undefined
) {
  switch (input) {
    case 'all':
      return
    case 'preferDraft':
      constraints.active = true
      return
    case 'preferPublished':
      constraints.main = true
      return
    default: {
      const status = statusValues(input ?? 'published')
      if (status) constraints.status = status
    }
  }
}

function isExactStatus(input: unknown): input is EntryStatus {
  return input === 'published' || input === 'draft' || input === 'archived'
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object')
}

const ENTRY_FIELD_ALIASES: Record<string, keyof RxbEntryRow> = {
  _id: 'id',
  _type: 'type',
  _index: 'index',
  _workspace: 'workspace',
  _root: 'root',
  _status: 'status',
  _parentId: 'parentId',
  _locale: 'locale',
  _path: 'path',
  _url: 'url',
  _active: 'active'
}
