import type {Config} from '#/core/Config.js'
import {Entry as EntryExpressions} from '#/core/Entry.js'
import {EntryFields} from '#/core/EntryFields.js'
import type {Expr} from '#/core/Expr.js'
import type {GraphQuery} from '#/core/Graph.js'
import {getExpr, hasExpr, hasRoot, hasWorkspace} from '#/core/Internal.js'
import {getScope, type Scope} from '#/core/Scope.js'
import type {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {
  and,
  asc,
  Builder,
  desc,
  eq,
  isNull,
  or,
  sql,
  type HasSql,
  type SelectionInput,
  type SelectionRecord,
  type Sql
} from 'rado'
import {EntryDataTable, EntryIndexTable} from '../entry/Schema.js'
import {
  columnField,
  compileCondition,
  compileFilter,
  jsonField,
  type QueryField
} from './Condition.js'

const builder = new Builder()

/** A compilation is scoped to a single SQL stage and records its payload needs. */
class Expressions {
  dataRequired = false
  #scope: Scope

  constructor(scope: Scope) {
    this.#scope = scope
  }

  data(path: Array<string>): QueryField {
    this.dataRequired = true
    return jsonField(EntryDataTable.data, path)
  }

  index(name: string, path?: Array<string>): QueryField {
    if (path) return this.data([...path, name])
    if (name === 'data') {
      this.dataRequired = true
      return columnField(EntryDataTable.data)
    }
    if (Object.hasOwn(EntryIndexTable, name))
      return columnField(
        EntryIndexTable[name as keyof typeof EntryIndexTable] as HasSql
      )
    const expr = EntryExpressions[name as keyof typeof EntryExpressions]
    if (expr) {
      const internal = getExpr(expr)
      if (internal.type === 'entryField' && internal.path)
        return this.data([...internal.path, name])
    }
    throw new Error(`Unsupported SQL entry field: ${name}`)
  }

  field(name: string): QueryField {
    return name.startsWith('_') ? this.index(name.slice(1)) : this.data([name])
  }

  expr(expression: Expr, selecting = false): HasSql {
    function value(field: QueryField) {
      return selecting ? (field.selection ?? field.value) : field.value
    }
    const internal = getExpr(expression)
    switch (internal.type) {
      case 'entryField':
        return value(this.index(internal.name, internal.path))
      case 'field': {
        const name = this.#scope.nameOf(expression)
        if (!name)
          throw new Error('Field expression is not in the configured schema')
        return value(this.data([name]))
      }
      case 'value':
        return sql.value(internal.value)
      case 'call':
        throw new Error(`Unsupported SQL function: ${internal.method}`)
    }
  }

  projection(value: unknown): SelectionInput {
    if (isRecord(value) && hasExpr(value)) return this.expr(value as Expr, true)
    if (!isRecord(value)) throw new Error('Invalid SQL projection')
    if ('edge' in value)
      throw new Error('SQL relation projections are not implemented yet')
    const result: SelectionRecord = {}
    for (const [key, nested] of Object.entries(value))
      result[key] = this.projection(nested)
    return result
  }
}

export function compileEntryQuery(config: Config, query: GraphQuery) {
  if (
    query.preview ||
    query.search ||
    query.groupBy ||
    query.alias ||
    'edge' in query
  )
    throw new Error(
      'SQL preview, search, grouping, aliases and relations require their dedicated query stages'
    )
  const scope = getScope(config)
  const membership = new Expressions(scope)
  const structural: Array<Sql<boolean>> = []
  const status = query.status ?? 'published'
  structural.push(
    status === 'all'
      ? sql.value(true)
      : status === 'preferDraft'
        ? eq(EntryIndexTable.active, true)
        : status === 'preferPublished'
          ? eq(EntryIndexTable.main, true)
          : eq(EntryIndexTable.status, status)
  )
  for (const key of ['id', 'parentId', 'path', 'url', 'level'] as const)
    if (query[key] !== undefined)
      structural.push(compileCondition(membership.index(key), query[key]))
  for (const key of ['workspace', 'root'] as const) {
    const input = query[key]
    const value =
      isRecord(input) && (hasWorkspace(input) || hasRoot(input))
        ? scope.nameOf(input as Parameters<Scope['nameOf']>[0])
        : input
    if (value !== undefined)
      structural.push(compileCondition(membership.index(key), value))
  }
  if (query.locale !== undefined)
    structural.push(
      compileCondition(
        membership.index('locale'),
        query.locale?.toLowerCase() ?? null
      )
    )
  else if (query.preferredLocale)
    structural.push(
      or(
        isNull(EntryIndexTable.locale),
        eq(EntryIndexTable.locale, query.preferredLocale.toLowerCase())
      )
    )
  if (query.type) {
    const types = Array.isArray(query.type) ? query.type : [query.type]
    const names = types.map(type => {
      const name = scope.nameOf(type)
      if (!name) throw new Error('Query type is not in the configured schema')
      return name
    })
    structural.push(compileCondition(membership.index('type'), {in: names}))
  }
  const location = Array.isArray(query.location)
    ? query.location
    : query.location && scope.locationOf(query.location)
  if (location) {
    if (location.length > 2)
      throw new Error('SQL page locations require a hierarchy query stage')
    if (location[0]) structural.push(eq(EntryIndexTable.workspace, location[0]))
    if (location[1]) structural.push(eq(EntryIndexTable.root, location[1]))
  }
  const content: Array<Sql<boolean>> = []
  for (const key of ['createdAt', 'updatedAt'] as const)
    if (query[key] !== undefined)
      content.push(compileCondition(membership.index(key), query[key]))
  if (query.filter !== undefined)
    content.push(compileFilter(query.filter, name => membership.field(name)))
  const ordering: Array<HasSql> = []
  if (query.orderBy) {
    for (const order of Array.isArray(query.orderBy)
      ? query.orderBy
      : [query.orderBy]) {
      if ((order.asc !== undefined) === (order.desc !== undefined))
        throw new Error('orderBy must specify exactly one direction')
      const value = membership.expr((order.asc ?? order.desc)!)
      // Nulls sort last in either direction. Natural string order is a later
      // dialect capability; do not silently substitute locale collation here.
      ordering.push(asc(isNull(value)), order.asc ? asc(value) : desc(value))
    }
  } else ordering.push(asc(EntryIndexTable.index))
  ordering.push(
    asc(EntryIndexTable.index),
    asc(EntryIndexTable.ordinal),
    asc(EntryIndexTable.versionId)
  )

  const projection = new Expressions(scope)
  const types = query.type
    ? ((Array.isArray(query.type) ? query.type : [query.type]) as Array<Type>)
    : []
  const selection = query.count
    ? EntryIndexTable.versionId
    : projection.projection(
        query.select ?? {
          ...Object.assign({}, ...types),
          ...EntryFields,
          ...(isRecord(query.include) ? query.include : {})
        }
      )
  let rows = builder
    .select(selection)
    .from(EntryIndexTable)
    .where(sql.value(true))
  if (membership.dataRequired || projection.dataRequired)
    rows = rows.leftJoin(
      EntryDataTable,
      eq(EntryIndexTable.versionId, EntryDataTable.versionId)
    )
  rows = rows.where(and(...structural, ...content)).orderBy(...ordering)
  for (const [key, value] of [
    ['skip', query.skip],
    ['take', query.take]
  ] as const)
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
      throw new Error(`${key} must be a non-negative integer`)
  if (query.skip) rows = rows.offset(query.skip)
  if (query.take !== undefined) rows = rows.limit(query.take)
  if (!query.count && (query.first || query.get))
    rows = rows.limit(query.take === 0 ? 0 : 1)

  // A conservative superset for hydration before content predicates or sorting.
  const candidates = builder
    .select(EntryIndexTable.versionId)
    .from(EntryIndexTable)
    .where(and(...structural))
  return {
    rows,
    candidates,
    membershipData: membership.dataRequired,
    projectionData: projection.dataRequired,
    count: query.count === true,
    single: Boolean(query.first || query.get)
  }
}
