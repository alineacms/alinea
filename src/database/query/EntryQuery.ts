import type {Config} from '#/core/Config.js'
import {aliasesFromData} from '#/core/db/EntryAliases.js'
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
  alias,
  and,
  asc,
  Builder,
  count,
  desc,
  eq,
  exists,
  getSql,
  include,
  isNull,
  or,
  sql,
  when,
  type HasSql,
  type SelectionInput,
  type SelectionRecord,
  type Sql
} from 'rado'
import {
  EntryIndexTable,
  storedEntryData,
  type EntryIndexTarget
} from '../entry/Schema.js'
import {
  arrayIncludes,
  compileCondition,
  compileFilter,
  jsonField
} from './Condition.js'
import {searchQuery} from './Search.js'

import {
  canBatchRelation,
  linkRelation,
  relationCondition,
  relationSource,
  type AnyRelationSource
} from './Relation.js'

const builder = new Builder()

interface RelationProjection {
  path: Array<string>
  query: EdgeQuery
  plan: ProjectionPlan
  embedded: boolean
}

interface FieldProjection {
  path: Array<string>
  field: Field
  name: string
}

interface OptionalProjection {
  path: Array<string>
  dataPath: Array<string>
}

export interface ProjectionPlan {
  count: boolean
  single: boolean
  needsSearch: boolean
  relations: Array<RelationProjection>
  fields: Array<FieldProjection>
  optional: Array<OptionalProjection>
}

interface CompiledRelation {
  selection: SelectionInput
  plan: ProjectionPlan
  embedded: boolean
}

/** Expressions over a complete entry row. */
class Expressions {
  relations: Array<RelationProjection> = []
  fields: Array<FieldProjection> = []
  optional: Array<OptionalProjection> = []
  #scope: Scope
  #search: ReturnType<typeof searchQuery>
  #entry: EntryIndexTarget
  #relation: (query: EdgeQuery) => CompiledRelation

  constructor(
    scope: Scope,
    entry: EntryIndexTarget,
    search: ReturnType<typeof searchQuery> | undefined,
    relation: (query: EdgeQuery) => CompiledRelation
  ) {
    this.#scope = scope
    this.#entry = entry
    this.#search = search
    this.#relation = relation
  }

  data(path: Array<string>): HasSql {
    if (path.length === 1 && path[0] === 'path') {
      const stored = jsonField(this.#entry.data, path)
      return sql`coalesce(${stored}, ${this.#entry.path})`
    }
    return jsonField(this.#entry.data, path)
  }

  index(name: string, path?: Array<string>): HasSql {
    if (path) return this.data([...path, name])
    if (Object.hasOwn(this.#entry, name))
      return this.#entry[name as keyof EntryIndexTarget] as HasSql
    const expr = EntryExpressions[name as keyof typeof EntryExpressions]
    if (expr) {
      const internal = getExpr(expr)
      if (internal.type === 'entryField' && internal.path)
        return this.data([...internal.path, name])
    }
    throw new Error(`Unsupported SQL entry field: ${name}`)
  }

  field(name: string): HasSql {
    return name.startsWith('_') ? this.index(name.slice(1)) : this.data([name])
  }

  selection(name: string, field: HasSql): HasSql {
    if (name === 'data')
      return sql`json_set(
        ${this.#entry.data}, '$.path',
        coalesce(json_extract(${this.#entry.data}, '$.path'), ${this.#entry.path})
      )`
        .forSelection()
        .mapWith({mapFromDriverValue: value => storedEntryData(value, '')})
    if (name === 'aliases')
      return sql`${this.#entry.data}`.forSelection().mapWith({
        mapFromDriverValue(value, specs) {
          const data = specs.parsesJson
            ? (value as Record<string, unknown>)
            : (JSON.parse(String(value)) as Record<string, unknown>)
          return aliasesFromData(data)
        }
      })
    return getSql(field).forSelection()
  }

  expr(expression: Expr, selecting = false): HasSql {
    const internal = getExpr(expression)
    switch (internal.type) {
      case 'entryField': {
        const field = this.index(internal.name, internal.path)
        return selecting ? this.selection(internal.name, field) : field
      }
      case 'field': {
        const name = this.#scope.nameOf(expression)
        if (!name)
          throw new Error('Field expression is not in the configured schema')
        const field = this.data([name])
        return selecting ? getSql(field).forSelection() : field
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
    return [this.expr(expression)]
  }

  projection(value: unknown, path: Array<string> = []): SelectionInput {
    if (isRecord(value) && hasExpr(value)) {
      const internal = getExpr(value as Expr)
      if (hasField(value)) {
        const field = value as Field
        const name = this.#scope.nameOf(field)
        if (!name)
          throw new Error('Field expression is not in the configured schema')
        this.fields.push({path, field, name})
      }
      if (
        internal.type === 'entryField' &&
        internal.path &&
        internal.name !== 'aliases'
      )
        this.optional.push({
          path,
          dataPath: [...internal.path, internal.name]
        })
      return this.expr(value as Expr, true)
    }
    if (!isRecord(value)) throw new Error('Invalid SQL projection')
    if ('edge' in value) {
      const query = value as unknown as EdgeQuery
      const relation = this.#relation(query)
      this.relations.push({
        path,
        query,
        plan: relation.plan,
        embedded: relation.embedded
      })
      return relation.selection
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
  source?: AnyRelationSource,
  search?: ReturnType<typeof searchQuery>,
  entry: EntryIndexTarget = EntryIndexTable,
  depth = 0,
  baseEntry: EntryIndexTarget = entry
) {
  if (query.preview)
    throw new Error('SQL preview requires its dedicated query stage')
  const scope = getScope(config)
  search ??= searchQuery(query.search, entry)
  const membership = new Expressions(scope, entry, search, () => {
    throw new Error('Relations cannot be used as query conditions')
  })
  const conditions: Array<Sql<boolean>> = []
  // An explicit authored status addresses physical versions, including one
  // currently hidden by another active/main version.
  if (query.versionStatus === undefined)
    conditions.push(eq(entry.visible, true))
  const edge = 'edge' in query ? (query as EdgeQuery) : undefined
  const link = edge?.edge === 'entrySingle' || edge?.edge === 'entryMultiple'
  let links: ReturnType<typeof linkRelation> | undefined
  if (edge) {
    if (!source) throw new Error('A relation query requires a source entry')
    if (link) {
      const name = scope.nameOf(edge.field)
      if (!name) throw new Error('Link field is not in the configured schema')
      links = linkRelation(entry, source, name, edge.edge === 'entryMultiple')
    } else conditions.push(relationCondition(entry, edge, source))
  }
  const status = query.status ?? 'published'
  conditions.push(
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
    'seeded',
    'url',
    'level'
  ] as const)
    if (query[key] !== undefined)
      conditions.push(compileCondition(membership.index(key), query[key]))
  for (const key of ['workspace', 'root'] as const) {
    const input = query[key]
    const value =
      isRecord(input) && (hasWorkspace(input) || hasRoot(input))
        ? scope.nameOf(input as Parameters<Scope['nameOf']>[0])
        : input
    if (value !== undefined)
      conditions.push(compileCondition(membership.index(key), value))
  }
  if (query.locale !== undefined && edge?.edge !== 'translations')
    conditions.push(
      query.locale === null
        ? isNull(entry.locale)
        : eq(sql`${entry.locale} collate nocase`, query.locale)
    )
  else if (query.preferredLocale && edge?.edge !== 'translations')
    conditions.push(
      or(
        isNull(entry.locale),
        eq(sql`${entry.locale} collate nocase`, query.preferredLocale)
      )
    )
  else if (link && source)
    conditions.push(
      or(
        isNull(entry.locale),
        eq(sql`${entry.locale} collate nocase`, source.locale)
      )
    )
  if (query.type) {
    const types = Array.isArray(query.type) ? query.type : [query.type]
    const names = types.map(type => {
      const name = scope.nameOf(type)
      if (!name) throw new Error('Query type is not in the configured schema')
      return name
    })
    conditions.push(compileCondition(membership.index('type'), {in: names}))
  }
  const location = Array.isArray(query.location)
    ? query.location
    : query.location && scope.locationOf(query.location)
  if (location && location.length >= 1 && location.length <= 3) {
    conditions.push(eq(entry.workspace, location[0]))
    if (location.length >= 2) conditions.push(eq(entry.root, location[1]))
    if (location.length === 3)
      conditions.push(eq(entry.sourceRoot, location[2]))
  }
  if (search) {
    conditions.push(search.condition)
  }
  if (query.alias !== undefined)
    conditions.push(
      arrayIncludes(membership.index('aliases'), item =>
        compileCondition(jsonField(item, ['url']), query.alias)
      )
    )
  for (const key of ['createdAt', 'updatedAt'] as const)
    if (query[key] !== undefined)
      conditions.push(compileCondition(membership.index(key), query[key]))
  if (query.filter !== undefined)
    conditions.push(compileFilter(query.filter, name => membership.field(name)))
  if (Array.isArray(query.groupBy))
    throw new Error('groupBy must be a single field')
  const grouping = query.groupBy
    ? membership.grouping(query.groupBy)
    : undefined
  const ordering: Array<HasSql> = []
  const stableOrdering = links
    ? [asc(links.ordinal)]
    : [asc(entry.index), asc(entry.filePath)]
  let uniquelyOrdered = false
  if (query.orderBy) {
    for (const order of Array.isArray(query.orderBy)
      ? query.orderBy
      : [query.orderBy]) {
      if ((order.asc !== undefined) === (order.desc !== undefined))
        throw new Error('orderBy must specify exactly one direction')
      const expression = (order.asc ?? order.desc)!
      const internal = getExpr(expression)
      const ordersByFilePath =
        internal.type === 'entryField' && internal.name === 'filePath'
      const value = membership.expr(expression)
      const collated = order.caseSensitive
        ? value
        : sql`${value} collate nocase`
      // Match the original resolver: strings are case-insensitive unless the
      // query opts in, and nulls sort last in either direction.
      if (!ordersByFilePath) ordering.push(asc(isNull(collated)))
      ordering.push(order.asc ? asc(collated) : desc(collated))
      uniquelyOrdered ||= ordersByFilePath
    }
  } else if (search) ordering.push(asc(search.rank))
  else if (edge?.edge === 'parents') ordering.push(asc(entry.level))
  else if (edge?.edge === 'translations' && edge.includeSelf)
    ordering.push(
      asc(
        when(
          [
            source?.locale === null
              ? isNull(entry.locale)
              : eq(entry.locale, source!.locale!),
            0
          ],
          1
        )
      )
    )
  if (!uniquelyOrdered) ordering.push(...stableOrdering)

  const projection = new Expressions(scope, entry, search, relationQuery => {
    if (canBatchRelation(relationQuery))
      return {
        selection: sql.value(null),
        plan: {
          count: false,
          single: false,
          needsSearch: false,
          relations: [],
          fields: [],
          optional: []
        },
        embedded: false
      }
    const nestedEntry = alias(baseEntry, `alinea_relation_${depth + 1}`)
    const nested = compileEntryQuery(
      config,
      {...relationQuery, status: query.status ?? 'published'},
      relationSource(entry),
      undefined,
      nestedEntry,
      depth + 1,
      baseEntry
    )
    const plan: ProjectionPlan = {
      count: nested.count,
      single: nested.single,
      needsSearch: nested.needsSearch,
      relations: nested.relations,
      fields: nested.fields,
      optional: nested.optional
    }
    if (nested.count) {
      const matches = nested.rows.as(`alinea_relation_count_${depth + 1}`)
      return {
        selection: include.one(
          builder.select(count().as('count')).from(matches)
        ),
        plan,
        embedded: true
      }
    }
    return {
      selection: nested.single
        ? include.one(nested.rows)
        : include(nested.rows),
      plan,
      embedded: true
    }
  })
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
    if (search) ranked = ranked.innerJoin(search.target, search.identity)
    if (links) ranked = ranked.innerJoin(links.target, eq(entry.id, links.id))
    const matches = ranked.where(and(...conditions)).as('group_matches')
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
  const single = Boolean(
    query.first ||
    query.get ||
    edge?.edge === 'parent' ||
    edge?.edge === 'next' ||
    edge?.edge === 'previous'
  )
  function selectRows(selection: SelectionInput) {
    let rows = builder.select(selection).from(entry).where(sql.value(true))
    if (search) rows = rows.innerJoin(search.target, search.identity)
    if (links) rows = rows.innerJoin(links.target, eq(entry.id, links.id))
    rows = rows
      .where(and(...conditions, ...(grouped ? [grouped] : [])))
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

  const needsContext =
    projection.relations.length ||
    projection.fields.length ||
    projection.optional.length
  return {
    rows: selectRows(
      needsContext
        ? {
            value: selection,
            source: relationSource(entry),
            ...(projection.fields.length || projection.optional.length
              ? {data: entry.data}
              : {})
          }
        : selection
    ),
    count: query.count === true,
    single,
    needsSearch:
      query.search !== undefined ||
      projection.relations.some(relation => relation.plan.needsSearch),
    relations: projection.relations,
    fields: projection.fields,
    optional: projection.optional
  }
}
