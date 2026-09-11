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
import {EntryIndexTable, type EntryIndexTarget} from '../entry/Schema.js'
import {
  columnField,
  arrayIncludes,
  compileCondition,
  compileFilter,
  jsonField,
  type QueryField
} from './Condition.js'
import {searchQuery} from './Search.js'

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

/** Expressions over a complete entry row. */
class Expressions {
  relations: Array<RelationProjection> = []
  fields: Array<FieldProjection> = []
  #scope: Scope
  #search: ReturnType<typeof searchQuery>
  #entry: EntryIndexTarget

  constructor(
    scope: Scope,
    entry: EntryIndexTarget,
    search?: ReturnType<typeof searchQuery>
  ) {
    this.#scope = scope
    this.#entry = entry
    this.#search = search
  }

  data(path: Array<string>): QueryField {
    return jsonField(this.#entry.data, path)
  }

  index(name: string, path?: Array<string>): QueryField {
    if (path) return this.data([...path, name])
    if (name === 'data') {
      return columnField(this.#entry.data)
    }
    if (Object.hasOwn(this.#entry, name))
      return columnField(this.#entry[name as keyof EntryIndexTarget] as HasSql)
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
      case 'call': {
        if (internal.method !== 'snippet')
          throw new Error(`Unsupported SQL function: ${internal.method}`)
        if (!this.#search)
          throw new Error('Snippet method requires search terms to be provided')
        const [start, end, cutOff, limit] = internal.args
        if (!start || !end || !cutOff || !limit)
          throw new Error('Snippet requires four arguments')
        const value = getExpr(limit)
        if (
          value.type !== 'value' ||
          !Number.isInteger(value.value) ||
          typeof value.value !== 'number' ||
          value.value <= 0 ||
          value.value > 64
        )
          throw new Error('Snippet limit must be an integer from 1 to 64')
        return this.#search.snippet(
          this.expr(start),
          this.expr(end),
          this.expr(cutOff),
          this.expr(limit)
        )
      }
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
        [inArray(kind, ['object', 'array']), this.#entry.versionId],
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
  source?: RelationSource,
  search?: ReturnType<typeof searchQuery>,
  entry: EntryIndexTarget = EntryIndexTable
) {
  if (query.preview)
    throw new Error('SQL preview requires its dedicated query stage')
  const scope = getScope(config)
  search ??= searchQuery(query.search, entry)
  const membership = new Expressions(scope, entry, search)
  const structural: Array<Sql<boolean>> = []
  structural.push(eq(entry.visible, true))
  const edge = 'edge' in query ? (query as EdgeQuery) : undefined
  const link = edge?.edge === 'entrySingle' || edge?.edge === 'entryMultiple'
  let links: ReturnType<typeof linkRelation> | undefined
  if (edge) {
    if (!source) throw new Error('A relation query requires a source entry')
    if (link) {
      const name = scope.nameOf(edge.field)
      if (!name) throw new Error('Link field is not in the configured schema')
      links = linkRelation(entry, source, name, edge.edge === 'entryMultiple')
    } else structural.push(relationCondition(entry, edge, source))
  }
  const status = query.status ?? 'published'
  structural.push(
    status === 'all'
      ? sql.value(true)
      : status === 'preferDraft'
        ? eq(entry.active, true)
        : status === 'preferPublished'
          ? eq(entry.main, true)
          : eq(entry.status, status)
  )
  for (const key of [
    'id',
    'parentId',
    'versionStatus',
    'main',
    'path',
    'filePath',
    'url',
    'level'
  ] as const)
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
        isNull(entry.locale),
        eq(entry.locale, query.preferredLocale.toLowerCase())
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
    structural.push(eq(entry.workspace, location[0]))
    if (location.length >= 2) structural.push(eq(entry.root, location[1]))
    if (location.length === 3)
      structural.push(eq(entry.sourceRoot, location[2]))
  }
  const content: Array<Sql<boolean>> = []
  if (search) {
    content.push(search.condition)
  }
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
  } else if (search) ordering.push(asc(search.rank))
  else if (links) ordering.push(asc(links.ordinal))
  else if (edge?.edge === 'parents') ordering.push(asc(entry.level))
  else ordering.push(asc(entry.index))
  ordering.push(
    links ? asc(links.ordinal) : asc(entry.index),
    asc(entry.filePath),
    asc(entry.versionId)
  )

  const projection = new Expressions(scope, entry, search)
  const types = query.type
    ? ((Array.isArray(query.type) ? query.type : [query.type]) as Array<Type>)
    : []
  const selection = query.count
    ? entry.versionId
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
        versionId: entry.versionId,
        linkOrdinal: links?.ordinal ?? sql.value(0),
        rank: sql<number>`row_number() over (partition by ${sql.join(grouping, sql`, `)}
        order by ${search?.rank ?? links?.ordinal ?? entry.index}, ${entry.filePath}, ${entry.versionId})`
      })
      .from(entry)
      .where(sql.value(true))
    if (links) ranked = ranked.innerJoin(links.target, eq(entry.id, links.id))
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
            eq(matches.versionId, entry.versionId),
            links ? eq(matches.linkOrdinal, links.ordinal) : sql.value(true)
          )
        )
    )
  }
  function selectRows(selection: SelectionInput) {
    let rows = builder.select(selection).from(entry).where(sql.value(true))
    if (links) rows = rows.innerJoin(links.target, eq(entry.id, links.id))
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
        ? {value: selection, source: relationSource(entry)}
        : selection
    ),
    identities: selectRows(entry.versionId),
    contextRows: selectRows({value: selection, source: relationSource(entry)}),
    count: query.count === true,
    single,
    relations: projection.relations,
    fields: projection.fields
  }
}
