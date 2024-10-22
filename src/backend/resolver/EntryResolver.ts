import {EntryFields} from 'alinea/core/EntryFields'
import {EntryPhase, EntryRow} from 'alinea/core/EntryRow'
import {EntrySearch} from 'alinea/core/EntrySearch'
import {Expr} from 'alinea/core/Expr'
import {Field} from 'alinea/core/Field'
import {Filter} from 'alinea/core/Filter'
import {
  GraphQuery,
  Order,
  Projection,
  querySource,
  RelatedQuery,
  Status
} from 'alinea/core/Graph'
import {getLocation, getType} from 'alinea/core/Internal'
import {Schema} from 'alinea/core/Schema'
import {getScope, Scope} from 'alinea/core/Scope'
import {Type} from 'alinea/core/Type'
import {hasExact} from 'alinea/core/util/Checks'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import * as cito from 'cito'
import {
  alias,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  include,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  Select,
  selection,
  SelectionInput,
  Sql,
  sql
} from 'rado'
import {Builder} from 'rado/core/Builder'
import {input} from 'rado/core/expr/Input'
import {getData, getTable, HasSql} from 'rado/core/Internal'
import {bm25} from 'rado/sqlite'
import type {Database} from '../Database.js'
import {Store} from '../Store.js'
import {LinkResolver} from './LinkResolver.js'
import {ResolveContext} from './ResolveContext.js'

const orFilter = cito.object({or: cito.array(cito.any)}).and(hasExact(['or']))
const andFilter = cito
  .object({and: cito.array(cito.any)})
  .and(hasExact(['and']))

const builder = new Builder()
const MAX_DEPTH = 999

type Interim = any

export interface PostContext {
  linkResolver: LinkResolver
}

export class EntryResolver {
  schema: Schema
  scope: Scope

  constructor(public db: Database) {
    this.schema = db.config.schema
    this.scope = getScope(db.config)
  }

  expr(ctx: ResolveContext, expr: Expr<any>): HasSql<any> {
    const name = this.scope.nameOf(expr)
    if (!name) throw new Error(`Expression has no name ${expr}`)
    const result =
      expr instanceof Field
        ? (<any>ctx.Table.data)[name]
        : ctx.Table[name as keyof EntryRow]
    if (!result) throw new Error(`Unknown field: "${name}"`)
    return result
  }

  selectCount(ctx: ResolveContext, hasSearch: boolean): SelectionInput {
    return count(hasSearch ? EntrySearch.rowid : ctx.Table.entryId).as('count')
  }

  projectTypes(types: Array<Type>): Projection {
    return fromEntries(
      entries(EntryFields as Projection).concat(
        types.flatMap((type): Array<[string, Expr]> => {
          return entries(getType(type).fields)
        })
      )
    )
  }

  projection(query: GraphQuery<Projection>): Projection {
    return (
      query.select ??
      (query.type
        ? this.projectTypes(
            Array.isArray(query.type) ? query.type : [query.type]
          )
        : EntryFields)
    )
  }

  selectProjection(ctx: ResolveContext, value: Projection): SelectionInput {
    if (value instanceof Expr) return this.expr(ctx, value)
    const source = querySource(value)
    if (!source)
      return fromEntries(
        entries(value).map(([key, value]) => {
          return [key, this.selectProjection(ctx, value as Projection)]
        })
      )
    const related = value as RelatedQuery<Projection>
    const isSingle = this.isSingleResult(related)
    const query = this.query(ctx, related)
    return isSingle ? include.one(query) : include(query)
  }

  select(ctx: ResolveContext, query: GraphQuery<Projection>): SelectionInput {
    if (query.count === true)
      return this.selectCount(ctx, Boolean(query.search?.length))
    if (query.select instanceof Expr) return this.expr(ctx, query.select)
    const fields = this.projection(query)
    return this.selectProjection(ctx, fromEntries(entries(fields)))
  }

  querySource(ctx: ResolveContext, query: RelatedQuery): Select<any> {
    const hasSearch = Boolean(query.search?.length)
    const {aliased} = getTable(ctx.Table)
    const cursor = hasSearch
      ? builder
          .select(ctx.Table)
          .from(EntrySearch)
          .innerJoin(
            ctx.Table,
            eq(sql`${sql.identifier(aliased)}.rowid`, EntrySearch.rowid)
          )
      : builder.select().from(ctx.Table)
    const from = alias(EntryRow, `E${ctx.depth - 1}`) // .as(source.id)
    switch (querySource(query)) {
      case 'parent':
        return cursor.where(eq(ctx.Table.entryId, from.parent)).limit(1)
      case 'next':
        return cursor
          .where(
            eq(ctx.Table.parent, from.parent),
            gt(ctx.Table.index, from.index)
          )
          .limit(1)
      case 'previous':
        return cursor
          .where(
            eq(ctx.Table.parent, from.parent),
            lt(ctx.Table.index, from.index)
          )
          .limit(1)
      case 'siblings':
        return cursor.where(
          eq(ctx.Table.parent, from.parent),
          query.siblings?.includeSelf
            ? undefined
            : ne(ctx.Table.entryId, from.entryId)
        )
      case 'translations':
        return cursor.where(
          eq(ctx.Table.i18nId, from.i18nId),
          query.translations?.includeSelf
            ? undefined
            : ne(ctx.Table.entryId, from.entryId)
        )
      case 'children':
        const Child = alias(EntryRow, 'Child')
        const children = builder.$with('children').as(
          builder
            .select({
              entryId: Child.entryId,
              parent: Child.parent,
              level: sql<number>`0`
            })
            .from(Child)
            .where(
              eq(Child.entryId, from.entryId),
              this.conditionStatus(Child, ctx.status),
              this.conditionLocale(Child, ctx.locale)
            )
            .unionAll(self =>
              builder
                .select({
                  entryId: Child.entryId,
                  parent: Child.parent,
                  level: sql<number>`${self.level} + 1`
                })
                .from(Child)
                .innerJoin(self, eq(self.entryId, Child.parent))
                .where(
                  this.conditionStatus(Child, ctx.status),
                  this.conditionLocale(Child, ctx.locale),
                  lt(
                    self.level,
                    Math.min(query.children?.depth ?? MAX_DEPTH, MAX_DEPTH)
                  )
                )
            )
        )
        const childrenIds = builder
          .withRecursive(children)
          .select(children.entryId)
          .from(children)
          .limit(-1)
          .offset(1)
        return cursor
          .where(inArray(ctx.Table.entryId, childrenIds))
          .orderBy(asc(ctx.Table.index))
      case 'parents':
        const Parent = alias(EntryRow, 'Parent')
        const parents = builder.$with('parents').as(
          builder
            .select({
              entryId: Parent.entryId,
              parent: Parent.parent,
              level: sql<number>`0`
            })
            .from(Parent)
            .where(
              eq(Parent.entryId, from.entryId),
              this.conditionStatus(Parent, ctx.status),
              this.conditionLocale(Parent, ctx.locale)
            )
            .unionAll(self =>
              builder
                .select({
                  entryId: Parent.entryId,
                  parent: Parent.parent,
                  level: sql<number>`${self.level} + 1`
                })
                .from(Parent)
                .innerJoin(self, eq(self.parent, Parent.entryId))
                .where(
                  this.conditionStatus(Parent, ctx.status),
                  this.conditionLocale(Parent, ctx.locale),
                  lt(
                    self.level,
                    Math.min(query.parents?.depth ?? MAX_DEPTH, MAX_DEPTH)
                  )
                )
            )
        )
        const parentIds = builder
          .withRecursive(parents)
          .select(parents.entryId)
          .from(parents)
          .limit(-1)
          .offset(1)
        return cursor
          .where(inArray(ctx.Table.entryId, parentIds))
          .orderBy(asc(ctx.Table.level))
      default:
        return cursor.orderBy(asc(ctx.Table.index))
    }
  }

  groupBy(ctx: ResolveContext, groupBy: Array<Expr<any>>): Array<HasSql> {
    return groupBy.map(expr => {
      return this.expr(ctx, expr)
    })
  }

  orderBy(ctx: ResolveContext, orderBy: Array<Order>): Array<Sql> {
    return orderBy
      .filter(order => order.asc || order.desc)
      .map(order => {
        const expr = this.expr(ctx, (order.asc ?? order.desc)!)
        const collated = order.caseSensitive
          ? expr
          : sql`${expr} collate nocase`
        const direction = order.desc ? desc : asc
        return direction(collated)
      })
  }

  conditionLocale(Table: typeof EntryRow, locale?: string) {
    if (!locale) return sql.value(true)
    return eq(Table.locale, locale)
  }

  conditionStatus(Table: typeof EntryRow, status: Status) {
    switch (status) {
      case 'published':
        return eq(Table.phase, EntryPhase.Published)
      case 'draft':
        return eq(Table.phase, EntryPhase.Draft)
      case 'archived':
        return eq(Table.phase, EntryPhase.Archived)
      case 'preferDraft':
        return Table.active
      case 'preferPublished':
        return Table.main
      case 'all':
        return sql.value(true)
    }
  }

  conditionLocation(Table: typeof EntryRow, location: Array<string>) {
    switch (location.length) {
      case 1:
        return eq(Table.workspace, location[0])
      case 2:
        return and(
          eq(Table.workspace, location[0]),
          eq(Table.root, location[1])
        )
      case 3:
        return and(
          eq(Table.workspace, location[0]),
          eq(Table.root, location[1]),
          like(Table.parentDir, `/${location[2]}%`)
        )
      default:
        return sql.value(true)
    }
  }

  conditionSearch(
    Table: typeof EntryRow,
    searchTerms: string | Array<string> | undefined
  ): Sql<boolean> {
    if (!searchTerms?.length) return sql.value(true)
    const terms = (Array.isArray(searchTerms) ? searchTerms : [searchTerms])
      .map(term => `"${term.replaceAll('"', '')}"*`)
      .join(' AND ')
    return sql`${input(EntrySearch)} match ${input(terms)}`
  }

  conditionTypes(ctx: ResolveContext, types: Type | Array<Type>) {
    if (Array.isArray(types)) {
      const names = types.map(type => this.scope.nameOf(type))
      return inArray(ctx.Table.type, names)
    }
    return eq(ctx.Table.type, this.scope.nameOf(types))
  }

  conditionFilter(ctx: ResolveContext, filter: Filter): Sql<boolean> {
    const isOrFilter = orFilter.check(filter)
    if (isOrFilter)
      return or(
        ...filter.or
          .filter(Boolean)
          .map(filter => this.conditionFilter(ctx, filter))
      )
    const isAndFilter = andFilter.check(filter)
    if (isAndFilter)
      return and(
        ...filter.and
          .filter(Boolean)
          .map(filter => this.conditionFilter(ctx, filter))
      )
    function filterField(ctx: ResolveContext, name: string): HasSql {
      if (name.startsWith('_')) {
        const entryProp = name.slice(1)
        const key = (
          entryProp === 'id' ? 'entryId' : entryProp
        ) as keyof EntryRow
        if (!(key in ctx.Table)) throw new Error(`Unknown field: "${name}"`)
        return ctx.Table[key]
      }
      return (<any>ctx.Table.data)[name]
    }
    const conditions = entries(filter).flatMap(function mapCondition(
      this: void,
      [key, value]
    ): Array<Sql<boolean>> {
      const field = filterField(ctx, key)
      if (typeof value !== 'object' || !value)
        return value === undefined
          ? []
          : [value === null ? isNull(field) : eq(field, value)]
      return entries(value).map(([op, value]) => {
        switch (op) {
          case 'is':
            if (value === null) return isNull(field)
            return eq(field, value)
          case 'isNot':
            if (value === null) return isNotNull(field)
            return ne(field, value)
          case 'gt':
            return gt(field, value)
          case 'gte':
            return gte(field, value)
          case 'lt':
            return lt(field, value)
          case 'lte':
            return lte(field, value)
          case 'startsWith':
            return like(field as HasSql<string>, `${value}%`)
          case 'or':
            if (Array.isArray(value))
              return or(
                ...value.map((c: unknown) => {
                  return and(...mapCondition([key, c]))
                })
              )
            return and(...mapCondition([key, value]))
          case 'in':
            return inArray(field, value)
          default:
            throw new Error(`Unknown filter operator: "${op}"`)
        }
      })
    })
    return and(...conditions)
  }

  query(ctx: ResolveContext, query: RelatedQuery<Projection>): Select<any> {
    const {type, filter, skip, take, orderBy, groupBy, first, search} = query
    ctx = ctx.increaseDepth().none
    let q = this.querySource(ctx, query)
    const queryData = getData(q)
    let preCondition = queryData.where as HasSql<boolean>
    let condition = and(
      preCondition,
      type ? this.conditionTypes(ctx, type as Type | Array<Type>) : undefined,
      this.conditionLocation(ctx.Table, ctx.location),
      this.conditionStatus(ctx.Table, ctx.status),
      querySource(query) === 'translations'
        ? undefined
        : this.conditionLocale(ctx.Table, ctx.locale),
      this.conditionSearch(ctx.Table, search)
    )
    if (skip) q = q.offset(skip)
    if (take) q = q.limit(take)
    const toSelect = this.select(ctx.select, query)
    let result = new Select({
      ...queryData,
      select: selection(toSelect),
      where: filter
        ? and(condition, this.conditionFilter(ctx, filter))
        : condition
    })
    if (groupBy)
      result = result.groupBy(
        ...this.groupBy(ctx, Array.isArray(groupBy) ? groupBy : [groupBy])
      )
    if (search?.length) result = result.orderBy(asc(bm25(EntrySearch, 20, 1)))
    else if (orderBy)
      result = result.orderBy(
        ...this.orderBy(ctx, Array.isArray(orderBy) ? orderBy : [orderBy])
      )

    if (first) result = result.limit(1)
    return result
  }

  isSingleResult(query: RelatedQuery): boolean {
    return Boolean(
      query.first || query.get || query.parent || query.next || query.previous
    )
  }

  async postField(
    ctx: PostContext,
    interim: Interim,
    field: Field
  ): Promise<void> {
    const shape = Field.shape(field)
    await shape.applyLinks(interim, ctx.linkResolver)
  }

  async postExpr(
    ctx: PostContext,
    interim: Interim,
    expr: Expr
  ): Promise<void> {
    if (expr instanceof Field) await this.postField(ctx, interim, expr)
  }

  async postRow(
    ctx: PostContext,
    interim: Interim,
    query: GraphQuery<Projection>
  ) {
    if (!interim) return
    const selected = this.projection(query)
    if (selected instanceof Expr) return this.postExpr(ctx, interim, selected)
    await Promise.all(
      entries(selected).map(([key, value]) => {
        const source = querySource(value)
        if (source)
          return this.post(ctx, interim[key], value as RelatedQuery<Projection>)
        return this.postExpr(ctx, interim[key], value as Expr)
      })
    )
  }

  post(ctx: PostContext, interim: Interim, input: RelatedQuery<Projection>) {
    if (input.count === true) return
    const isSingle = this.isSingleResult(input)
    if (isSingle) return this.postRow(ctx, interim, input)
    return Promise.all(interim.map((row: any) => this.postRow(ctx, row, input)))
  }

  resolve = async <T>(query: GraphQuery): Promise<T> => {
    const location = Array.isArray(query.location)
      ? query.location
      : query.location && getLocation(query.location)
    const ctx = new ResolveContext({
      ...query,
      location
    })
    const dbQuery = this.query(ctx, query as GraphQuery<Projection>)
    const singleResult = this.isSingleResult(query)
    const transact = async (tx: Store): Promise<T> => {
      const rows = await dbQuery.all(tx)
      const linkResolver = new LinkResolver(this, tx, ctx.status)
      const result = singleResult ? rows[0] : rows
      if (result)
        await this.post({linkResolver}, result, query as GraphQuery<Projection>)
      return result as T
    }
    if (query.preview) {
      const updated = 'entry' in query.preview ? query.preview.entry : undefined
      if (updated) {
        const result = await this.db.preview<T>(updated, transact)
        if (result) return result
      }
    }
    return this.db.store.transaction(transact)
  }
}
