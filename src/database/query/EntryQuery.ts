import type {Config} from '#/core/Config.js'
import {Entry as EntryExpressions} from '#/core/Entry.js'
import {EntryFields} from '#/core/EntryFields.js'
import type {Expr} from '#/core/Expr.js'
import type {Field} from '#/core/Field.js'
import type {EdgeQuery, GraphQuery, Status} from '#/core/Graph.js'
import {
  getExpr,
  hasExpr,
  hasField,
  hasRoot,
  hasWorkspace
} from '#/core/Internal.js'
import {getScope, type Entity, type Scope} from '#/core/Scope.js'
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
  getQuery,
  inArray,
  include,
  isNull,
  or,
  sql,
  when,
  type DriverSpecs,
  type HasSql,
  type SelectionInput,
  type SelectionRecord,
  type Sql
} from 'rado'
import {
  EntryIndexTable,
  storedEntryData,
  type EntryIndexTarget
} from '../entry/EntryTable.js'
import {
  arrayIncludes,
  compileCondition,
  compileFilter,
  jsonField
} from './Condition.js'
import {
  EntrySearchTable,
  searchableText,
  searchQuery,
  type EntrySearchTarget
} from './Search.js'

import {linkRelation, relationCondition} from './Relation.js'

const builder = new Builder()

/** Read a selected JSON path; SQLite's -> yields SQL null only when absent. */
function readJson(value: unknown, specs: DriverSpecs): unknown {
  if (value === null) return undefined
  return specs.parsesJson ? value : JSON.parse(String(value))
}

interface RelationProjection {
  path: Array<string>
  plan: ProjectionPlan
}

interface FieldProjection {
  path: Array<string>
  field: Field
}

export interface ProjectionPlan {
  count: boolean
  single: boolean
  /** Rows carry the selection as `value`, next to the columns they need. */
  wrapped: boolean
  /** The locale the query asked for, for rows of untranslated entries */
  locale: string | null
  relations: Array<RelationProjection>
  fields: Array<FieldProjection>
}

interface CompiledRelation {
  selection: SelectionInput
  plan: ProjectionPlan
}

/** Expressions over a complete entry row. */
class Expressions {
  relations: Array<RelationProjection> = []
  fields: Array<FieldProjection> = []
  #scope: Scope
  #search: ReturnType<typeof searchQuery>
  #searchTable: EntrySearchTarget
  #entry: EntryIndexTarget
  #relation?: (query: EdgeQuery) => CompiledRelation
  #scalar?: (query: EdgeQuery) => HasSql

  constructor(
    scope: Scope,
    entry: EntryIndexTarget,
    searchTable: EntrySearchTarget,
    search: ReturnType<typeof searchQuery> | undefined,
    relation?: (query: EdgeQuery) => CompiledRelation,
    scalar?: (query: EdgeQuery) => HasSql
  ) {
    this.#scope = scope
    this.#entry = entry
    this.#searchTable = searchTable
    this.#search = search
    this.#relation = relation
    this.#scalar = scalar
  }

  /** A stored value; selected, an absent key reads as undefined. */
  data(path: Array<string>, selecting = false): HasSql {
    const stored = jsonField(this.#entry.data, path)
    if (path.length === 1 && path[0] === 'path')
      return sql`coalesce(${stored}, ${this.#entry.path})`
    if (!selecting) return stored
    return getSql(stored).forSelection().mapWith({mapFromDriverValue: readJson})
  }

  index(name: string, path?: Array<string>, selecting = false): HasSql {
    if (path) return this.data([...path, name], selecting)
    if (name === 'searchableText') {
      const text = searchableText(this.#entry, this.#searchTable)
      // Relations select fields by name.
      return selecting ? text.as(name) : text
    }
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

  selection(name: string, path?: Array<string>): HasSql {
    if (name === 'data')
      return sql`json_set(
        ${this.#entry.data}, '$.path',
        coalesce(json_extract(${this.#entry.data}, '$.path'), ${this.#entry.path})
      )`
        .forSelection()
        .mapWith({mapFromDriverValue: value => storedEntryData(value, '')})
    const field = getSql(this.index(name, path, true))
    if (name !== 'aliases') return field
    return field.mapWith({
      mapFromDriverValue(value, specs) {
        const aliases = readJson(value, specs)
        return Array.isArray(aliases) ? aliases : undefined
      }
    })
  }

  expr(expression: Expr, selecting = false): HasSql {
    const internal = getExpr(expression)
    switch (internal.type) {
      case 'entryField':
        return selecting
          ? this.selection(internal.name, internal.path)
          : this.index(internal.name, internal.path)
      case 'field': {
        const name = this.#scope.nameOf(expression)
        if (!name)
          throw new Error('Field expression is not in the configured schema')
        return this.data([name], selecting)
      }
      case 'value':
        return sql.value(internal.value)
      case 'relation': {
        if (!this.#scalar)
          throw new Error('Relation expressions are not supported here')
        const value = this.#scalar(internal.query)
        return selecting ? getSql(value).forSelection() : value
      }
      case 'typeSwitch': {
        const branches = Object.entries(internal.cases).map(
          ([type, inner]) =>
            sql`when ${this.#entry.type} = ${sql.value(type)} then ${this.expr(inner)}`
        )
        const value = branches.length
          ? sql`(case ${sql.join(branches, sql` `)} end)`
          : sql`null`
        return selecting ? getSql(value).forSelection() : value
      }
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

  projection(value: unknown, path: Array<string> = []): SelectionInput {
    if (isRecord(value) && hasExpr(value)) {
      if (hasField(value)) this.fields.push({path, field: value as Field})
      return this.expr(value as Expr, true)
    }
    if (!isRecord(value)) throw new Error('Invalid SQL projection')
    if ('edge' in value) {
      if (!this.#relation)
        throw new Error('Relations cannot be used as query conditions')
      const relation = this.#relation(value as unknown as EdgeQuery)
      this.relations.push({path, plan: relation.plan})
      return relation.selection
    }
    const result: SelectionRecord = {}
    for (const [key, nested] of Object.entries(value))
      result[key] = this.projection(nested, [...path, key])
    return result
  }
}

/** Rows visible under a query status; the default addresses published rows. */
export function statusCondition(
  entry: EntryIndexTarget,
  status: Status = 'published'
): Sql<boolean> {
  switch (status) {
    case 'all':
      return sql.value(true)
    case 'preferDraft':
      return eq(entry.active, true)
    case 'preferPublished':
      return eq(entry.main, true)
    default:
      return eq(entry.status, status)
  }
}

/**
 * Rows in one locale; null is unlocalized. Stored locales use the configured
 * spelling, so a requested locale matches any case of it.
 */
export function localeCondition(
  scope: Scope,
  entry: EntryIndexTarget,
  locale: string | null | HasSql<string | null>
): Sql<boolean> {
  if (locale === null) return isNull(entry.locale)
  if (typeof locale !== 'string') return eq(entry.locale, locale)
  const spellings = scope.locales(locale)
  return spellings.length === 1
    ? eq(entry.locale, spellings[0])
    : inArray(entry.locale, spellings)
}

interface EntryQueryOptions {
  source?: EntryIndexTarget
  search?: ReturnType<typeof searchQuery>
  entry?: EntryIndexTarget
  depth?: number
  baseEntry?: EntryIndexTarget
  searchTable?: EntrySearchTarget
  /** Select the single expression of the query, to use it as a subquery */
  scalar?: boolean
}

export function compileEntryQuery(
  config: Config,
  query: GraphQuery,
  options: EntryQueryOptions = {}
) {
  const {
    source,
    entry = EntryIndexTable,
    depth = 0,
    baseEntry = entry,
    searchTable = EntrySearchTable
  } = options
  const search = options.search ?? searchQuery(query.search, entry, searchTable)
  if (query.preview)
    throw new Error('SQL preview requires its dedicated query stage')
  const scope = getScope(config)
  // A related entry's value, eg. to order by the title of a linked entry
  function scalar(relationQuery: EdgeQuery): HasSql {
    if (!isRecord(relationQuery.select) || !hasExpr(relationQuery.select))
      throw new Error('A relation expression must select a single expression')
    const {rows} = compileEntryQuery(
      config,
      {...relationQuery, status: query.status ?? 'published'},
      {
        source: entry,
        entry: alias(baseEntry, `alinea_scalar_${depth + 1}`),
        depth: depth + 1,
        baseEntry,
        searchTable,
        scalar: true
      }
    )
    return sql`(${getQuery(rows)})`
  }
  const membership = new Expressions(
    scope,
    entry,
    searchTable,
    search,
    undefined,
    scalar
  )
  const queryTypes: Array<Type> = query.type
    ? ((Array.isArray(query.type) ? query.type : [query.type]) as Array<Type>)
    : []
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
      links = linkRelation(source, name, edge.edge === 'entryMultiple')
    } else conditions.push(relationCondition(entry, edge, source))
  }
  conditions.push(statusCondition(entry, query.status))
  for (const key of [
    'id',
    'parentId',
    'versionStatus',
    'main',
    'path',
    'filePath',
    'seeded',
    'url',
    'level',
    'createdAt',
    'updatedAt'
  ] as const)
    if (query[key] !== undefined)
      conditions.push(compileCondition(membership.index(key), query[key]))
  for (const key of ['workspace', 'root'] as const) {
    const input = query[key]
    const value =
      isRecord(input) && (hasWorkspace(input) || hasRoot(input))
        ? scope.nameOf(input as Entity)
        : input
    if (value !== undefined)
      conditions.push(compileCondition(membership.index(key), value))
  }
  if (query.locale !== undefined && edge?.edge !== 'translations')
    conditions.push(localeCondition(scope, entry, query.locale))
  else if (query.preferredLocale && edge?.edge !== 'translations')
    conditions.push(
      or(
        isNull(entry.locale),
        localeCondition(scope, entry, query.preferredLocale)
      )
    )
  else if (link && source)
    conditions.push(
      or(isNull(entry.locale), localeCondition(scope, entry, source.locale))
    )
  if (query.type) {
    const names = queryTypes.map(type => {
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
  if (search) conditions.push(search.condition)
  if (query.alias !== undefined)
    conditions.push(
      arrayIncludes(membership.index('aliases'), item =>
        compileCondition(jsonField(item, ['url']), query.alias, 1)
      )
    )
  if (query.filter !== undefined)
    conditions.push(compileFilter(query.filter, name => membership.field(name)))
  if (Array.isArray(query.groupBy))
    throw new Error('groupBy must be a single field')
  const grouping = query.groupBy ? [membership.expr(query.groupBy)] : undefined
  const ordering: Array<HasSql> = []
  const stableOrdering = links
    ? [asc(links.ordinal)]
    : [asc(entry.index), asc(entry.filePath)]
  let uniquelyOrdered = false
  if (query.orderBy) {
    for (const order of Array.isArray(query.orderBy)
      ? query.orderBy
      : [query.orderBy]) {
      const expression = order.asc ?? order.desc
      if (!expression || (order.asc !== undefined && order.desc !== undefined))
        throw new Error('orderBy must specify exactly one direction')
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
  // The entry's own language first. SQLite before 3.45 cannot order a
  // relation by a column of its source, so it orders by a selected column.
  const selfFirst =
    !query.orderBy &&
    !search &&
    edge?.edge === 'translations' &&
    edge.includeSelf &&
    source
      ? when([eq(entry.locale, source.locale), 0], 1)
      : undefined
  if (selfFirst) ordering.push(asc(sql.identifier('selfFirst')))
  if (!uniquelyOrdered) ordering.push(...stableOrdering)

  function relation(relationQuery: EdgeQuery): CompiledRelation {
    const nestedEntry = alias(baseEntry, `alinea_relation_${depth + 1}`)
    const {rows, plan} = compileEntryQuery(
      config,
      {...relationQuery, status: query.status ?? 'published'},
      {
        source: entry,
        entry: nestedEntry,
        depth: depth + 1,
        baseEntry,
        searchTable
      }
    )
    if (plan.count) {
      const matches = rows.as(`alinea_relation_count_${depth + 1}`)
      return {
        selection: include.one(
          builder.select(count().as('count')).from(matches)
        ),
        plan
      }
    }
    return {
      selection: plan.single ? include.one(rows) : include(rows),
      plan
    }
  }
  const projection = new Expressions(
    scope,
    entry,
    searchTable,
    search,
    relation,
    scalar
  )
  const selection = query.count
    ? entry.versionId
    : options.scalar
      ? membership.expr(query.select as Expr, true)
      : projection.projection(
          query.select ?? {
            ...Object.assign({}, ...queryTypes),
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
    options.scalar ||
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

  // Fields resolve their links in the locale of the entry they were read
  // from; the own language first is ordered by its selected column.
  const wrapped =
    !options.scalar &&
    Boolean(
      projection.relations.length || projection.fields.length || selfFirst
    )
  const plan: ProjectionPlan = {
    count: query.count === true,
    single,
    wrapped,
    locale: query.locale ?? query.preferredLocale ?? null,
    relations: projection.relations,
    fields: projection.fields
  }
  return {
    rows: selectRows(
      wrapped
        ? {
            value: selection,
            locale: entry.locale,
            ...(selfFirst ? {selfFirst} : {})
          }
        : selection
    ),
    plan
  }
}
