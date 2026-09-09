import type {Config} from '#/core/Config.js'
import {Entry as EntryExpressions} from '#/core/Entry.js'
import {EntryFields} from '#/core/EntryFields.js'
import type {Expr} from '#/core/Expr.js'
import type {Field} from '#/core/Field.js'
import type {EdgeQuery, GraphQuery} from '#/core/Graph.js'
import {
  getExpr,
  hasExpr,
  hasField,
  hasRoot,
  hasWorkspace
} from '#/core/Internal.js'
import {getScope, type Scope} from '#/core/Scope.js'
import type {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {
  and,
  asc,
  Builder,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  or,
  sql,
  when,
  type HasSql,
  type SelectionInput,
  type SelectionRecord,
  type Sql
} from 'rado'
import {EntryDataTable, EntryIndexTable, sourceFields} from '../entry/Schema.js'
import {
  columnField,
  arrayIncludes,
  compileCondition,
  compileFilter,
  jsonField,
  type QueryField
} from './Condition.js'
import {aliasesField} from './Aliases.js'

import {
  linkRelation,
  relationCondition,
  relationSource,
  type RelationSource
} from './Relation.js'

const builder = new Builder()

interface RelationProjection {
  path: Array<string>
  query: EdgeQuery
}

interface FieldProjection {
  path: Array<string>
  field: Field
}

/** A compilation is scoped to a single SQL stage and records its payload needs. */
class Expressions {
  dataRequired = false
  relations: Array<RelationProjection> = []
  fields: Array<FieldProjection> = []
  #scope: Scope

  constructor(scope: Scope) {
    this.#scope = scope
  }

  data(path: Array<string>): QueryField {
    this.dataRequired = true
    return jsonField(EntryDataTable.data, path)
  }

  index(name: string, path?: Array<string>): QueryField {
    if (name === 'aliases') {
      this.dataRequired = true
      return aliasesField(EntryDataTable.data)
    }
    if (path) return this.data([...path, name])
    if (sourceFields.some(field => field === name)) {
      this.dataRequired = true
      return jsonField(EntryDataTable.source, [name])
    }
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

  grouping(expression: Expr): Array<HasSql> {
    const internal = getExpr(expression)
    let field: QueryField
    if (internal.type === 'entryField') {
      field =
        internal.name === 'data'
          ? this.data([])
          : this.index(internal.name, internal.path)
    } else if (internal.type === 'field') {
      const name = this.#scope.nameOf(expression)
      if (!name)
        throw new Error('Field expression is not in the configured schema')
      field = this.data([name])
    } else return [this.expr(expression)]
    if (!field.jsonType) return [field.value]
    const kind = field.jsonType
    // Match Map's primitive keys: numbers share one type, null and missing do
    // not, and independently decoded objects/arrays are distinct identities.
    return [
      when<string | null>(
        [inArray(kind, ['integer', 'real', 'number']), 'number'],
        [inArray(kind, ['true', 'false', 'boolean']), 'boolean'],
        kind
      ),
      when<unknown>(
        [inArray(kind, ['object', 'array']), EntryIndexTable.versionId],
        field.value
      )
    ]
  }

  projection(value: unknown, path: Array<string> = []): SelectionInput {
    if (isRecord(value) && hasExpr(value)) {
      if (hasField(value)) this.fields.push({path, field: value as Field})
      return this.expr(value as Expr, true)
    }
    if (!isRecord(value)) throw new Error('Invalid SQL projection')
    if ('edge' in value) {
      this.relations.push({path, query: value as unknown as EdgeQuery})
      return sql.value(null)
    }
    const result: SelectionRecord = {}
    for (const [key, nested] of Object.entries(value))
      result[key] = this.projection(nested, [...path, key])
    return result
  }
}

export function compileEntryQuery(
  config: Config,
  query: GraphQuery,
  source?: RelationSource
) {
  if (query.preview || query.search)
    throw new Error(
      'SQL preview and search require their dedicated query stages'
    )
  const scope = getScope(config)
  const membership = new Expressions(scope)
  const structural: Array<Sql<boolean>> = []
  const edge = 'edge' in query ? (query as EdgeQuery) : undefined
  const link = edge?.edge === 'entrySingle' || edge?.edge === 'entryMultiple'
  let links: ReturnType<typeof linkRelation> | undefined
  if (edge) {
    if (!source) throw new Error('A relation query requires a source entry')
    if (link) {
      const name = scope.nameOf(edge.field)
      if (!name) throw new Error('Link field is not in the configured schema')
      links = linkRelation(source, name, edge.edge === 'entryMultiple')
    } else structural.push(relationCondition(edge, source))
  }
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
  if (query.locale !== undefined && edge?.edge !== 'translations')
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
  if (location && location.length >= 1 && location.length <= 3) {
    structural.push(eq(EntryIndexTable.workspace, location[0]))
    if (location.length >= 2)
      structural.push(eq(EntryIndexTable.root, location[1]))
    if (location.length === 3)
      structural.push(eq(EntryIndexTable.sourceRoot, location[2]))
  }
  const content: Array<Sql<boolean>> = []
  if (query.alias !== undefined)
    content.push(
      arrayIncludes(membership.index('aliases'), item => {
        const url = item.child('url')
        return and(
          inArray(url.jsonType!, ['text', 'string']),
          compileCondition(url, query.alias)
        )
      })
    )
  for (const key of ['createdAt', 'updatedAt'] as const)
    if (query[key] !== undefined)
      content.push(compileCondition(membership.index(key), query[key]))
  if (query.filter !== undefined)
    content.push(compileFilter(query.filter, name => membership.field(name)))
  if (Array.isArray(query.groupBy))
    throw new Error('groupBy must be a single field')
  const grouping = query.groupBy
    ? membership.grouping(query.groupBy)
    : undefined
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
  } else if (links) ordering.push(asc(links.ordinal))
  else if (edge?.edge === 'parents') ordering.push(asc(EntryIndexTable.level))
  else ordering.push(asc(EntryIndexTable.index))
  ordering.push(
    links ? asc(links.ordinal) : asc(EntryIndexTable.index),
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
  for (const [key, value] of [
    ['skip', query.skip],
    ['take', query.take]
  ] as const)
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
      throw new Error(`${key} must be a non-negative integer`)
  // Graph picks the first source-ordered match in each group before ordering
  // or pagination. Rank identities, not projected values, to preserve that rule.
  let grouped: Sql<boolean> | undefined
  if (grouping) {
    let ranked = builder
      .select({
        versionId: EntryIndexTable.versionId,
        linkOrdinal: links?.ordinal ?? sql.value(0),
        rank: sql<number>`row_number() over (partition by ${sql.join(grouping, sql`, `)}
        order by ${links?.ordinal ?? EntryIndexTable.index}, ${EntryIndexTable.ordinal}, ${EntryIndexTable.versionId})`
      })
      .from(EntryIndexTable)
      .where(sql.value(true))
    if (links)
      ranked = ranked.innerJoin(links.target, eq(EntryIndexTable.id, links.id))
    if (membership.dataRequired)
      ranked = ranked.leftJoin(
        EntryDataTable,
        eq(EntryIndexTable.versionId, EntryDataTable.versionId)
      )
    const matches = ranked
      .where(and(...structural, ...content))
      .as('group_matches')
    grouped = exists(
      builder
        .select(sql.value(1))
        .from(matches)
        .where(
          and(
            eq(matches.rank, 1),
            eq(matches.versionId, EntryIndexTable.versionId),
            links ? eq(matches.linkOrdinal, links.ordinal) : sql.value(true)
          )
        )
    )
  }
  function selectRows(selection: SelectionInput, data: boolean) {
    let rows = builder
      .select(selection)
      .from(EntryIndexTable)
      .where(sql.value(true))
    if (links)
      rows = rows.innerJoin(links.target, eq(EntryIndexTable.id, links.id))
    if (data)
      rows = rows.leftJoin(
        EntryDataTable,
        eq(EntryIndexTable.versionId, EntryDataTable.versionId)
      )
    rows = rows
      .where(and(...structural, ...content, ...(grouped ? [grouped] : [])))
      .orderBy(...ordering)
    if (query.skip) rows = rows.offset(query.skip)
    if (query.take) rows = rows.limit(query.take)
    else if (query.skip)
      // SQLite requires a LIMIT with OFFSET. This is also accepted by the
      // other drivers and covers every safely representable Graph row count.
      rows = rows.limit(Number.MAX_SAFE_INTEGER)
    if (!query.count && single) rows = rows.limit(1)
    return rows
  }

  // A conservative superset for hydration before content predicates or sorting.
  let candidates = builder
    .select(EntryIndexTable.versionId)
    .from(EntryIndexTable)
    .where(and(...structural))
  if (links)
    candidates = candidates.innerJoin(
      links.target,
      eq(EntryIndexTable.id, links.id)
    )
  const single = Boolean(
    query.first ||
    query.get ||
    edge?.edge === 'parent' ||
    edge?.edge === 'next' ||
    edge?.edge === 'previous'
  )
  return {
    rows: selectRows(
      projection.relations.length
        ? {value: selection, source: relationSource}
        : selection,
      membership.dataRequired || projection.dataRequired
    ),
    identities: selectRows(EntryIndexTable.versionId, membership.dataRequired),
    contextRows: selectRows(
      {value: selection, source: relationSource},
      membership.dataRequired || projection.dataRequired
    ),
    candidates,
    membershipData: membership.dataRequired,
    projectionData: projection.dataRequired,
    count: query.count === true,
    single,
    relations: projection.relations,
    fields: projection.fields
  }
}
