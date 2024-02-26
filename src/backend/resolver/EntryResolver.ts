import {EntryPhase, EntryRow, EntryTable} from 'alinea/core/EntryRow'
import {EntrySearch} from 'alinea/core/EntrySearch'
import {Field} from 'alinea/core/Field'
import {
  PreviewUpdate,
  ResolveDefaults,
  ResolveRequest
} from 'alinea/core/Resolver'
import {Schema} from 'alinea/core/Schema'
import {Type} from 'alinea/core/Type'
import type * as pages from 'alinea/core/pages'
import {Realm} from 'alinea/core/pages/Realm'
import {BinaryOp, SourceType, UnaryOp} from 'alinea/core/pages/ResolveData'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {unreachable} from 'alinea/core/util/Types'
import {
  BinOpType,
  Expr,
  ExprData,
  OrderBy,
  OrderDirection,
  ParamData,
  Query,
  QueryData,
  Select,
  Table,
  UnOpType,
  withRecursive
} from 'rado'
import {bm25, iif, match, snippet, count as sqlCount} from 'rado/sqlite'
import {Database} from '../Database.js'
import {LinkResolver} from './LinkResolver.js'
import {ResolveContext} from './ResolveContext.js'

const unOps = {
  [UnaryOp.Not]: UnOpType.Not,
  [UnaryOp.IsNull]: UnOpType.IsNull
}

const binOps = {
  [BinaryOp.Add]: BinOpType.Add,
  [BinaryOp.Subt]: BinOpType.Subt,
  [BinaryOp.Mult]: BinOpType.Mult,
  [BinaryOp.Mod]: BinOpType.Mod,
  [BinaryOp.Div]: BinOpType.Div,
  [BinaryOp.Greater]: BinOpType.Greater,
  [BinaryOp.GreaterOrEqual]: BinOpType.GreaterOrEqual,
  [BinaryOp.Less]: BinOpType.Less,
  [BinaryOp.LessOrEqual]: BinOpType.LessOrEqual,
  [BinaryOp.Equals]: BinOpType.Equals,
  [BinaryOp.NotEquals]: BinOpType.NotEquals,
  [BinaryOp.And]: BinOpType.And,
  [BinaryOp.Or]: BinOpType.Or,
  [BinaryOp.Like]: BinOpType.Like,
  [BinaryOp.In]: BinOpType.In,
  [BinaryOp.NotIn]: BinOpType.NotIn,
  [BinaryOp.Concat]: BinOpType.Concat
}

const MAX_DEPTH = 999

const pageFields = keys(EntryRow)

type Interim = any

export interface PostContext {
  linkResolver: LinkResolver
}

export class EntryResolver {
  targets: Schema.Targets

  constructor(
    public db: Database,
    public schema: Schema,
    public parsePreview?: (
      preview: PreviewUpdate
    ) => Promise<EntryRow | undefined>,
    public defaults?: ResolveDefaults
  ) {
    this.targets = Schema.targets(schema)
  }

  fieldOf(
    ctx: ResolveContext,
    target: pages.TargetData,
    field: string
  ): ExprData {
    const {name} = target
    if (!name) {
      const fields: Record<string, Expr<any>> = ctx.Table as any
      if (field in fields) return fields[field][Expr.Data]
      throw new Error(`Selecting unknown field: "${field}"`)
    }
    const type = this.schema[name]
    if (!type)
      throw new Error(`Selecting "${field}" from unknown type: "${name}"`)
    return ctx.Table.data.get(field)[Expr.Data]
  }

  pageFields(ctx: ResolveContext): Array<[string, ExprData]> {
    return pageFields.map(key => [key, this.fieldOf(ctx, {}, key)])
  }

  selectFieldsOf(
    ctx: ResolveContext,
    target: pages.TargetData
  ): Array<[string, ExprData]> {
    const {name} = target
    if (!name) return this.pageFields(ctx)
    const type = this.schema[name]
    if (!type) throw new Error(`Selecting from unknown type: "${name}"`)
    return keys(type).map(key => {
      return [key, this.fieldOf(ctx, target, key)]
    })
  }

  exprUnOp(ctx: ResolveContext, {op, expr}: pages.ExprData.UnOp): ExprData {
    return new ExprData.UnOp(unOps[op], this.expr(ctx, expr))
  }

  exprBinOp(ctx: ResolveContext, {op, a, b}: pages.ExprData.BinOp): ExprData {
    return new ExprData.BinOp(binOps[op], this.expr(ctx, a), this.expr(ctx, b))
  }

  exprField(
    ctx: ResolveContext,
    {target, field}: pages.ExprData.Field
  ): ExprData {
    return this.fieldOf(ctx, target, field)
  }

  exprAccess(
    ctx: ResolveContext,
    {expr, field}: pages.ExprData.Access
  ): ExprData {
    return new ExprData.Field(this.expr(ctx.access, expr), field)
  }

  exprValue(ctx: ResolveContext, {value}: pages.ExprData.Value): ExprData {
    return new ExprData.Param(new ParamData.Value(value))
  }

  exprRecord(ctx: ResolveContext, {fields}: pages.ExprData.Record): ExprData {
    return new ExprData.Record(
      fromEntries(
        entries(fields).map(([key, expr]) => {
          return [key, this.expr(ctx, expr)]
        })
      )
    )
  }

  exprCase(
    ctx: ResolveContext,
    {expr, cases, defaultCase}: pages.ExprData.Case
  ): ExprData {
    const subject = new Expr(this.expr(ctx, expr))
    let res = new Expr(
      defaultCase ? this.select(ctx, defaultCase) : Expr.NULL[Expr.Data]
    )
    for (const [condition, value] of cases)
      res = iif(
        subject.is(new Expr(this.expr(ctx, condition))),
        new Expr(this.select(ctx, value)),
        res
      )
    return res[Expr.Data]
  }

  exprCall(ctx: ResolveContext, {method, args}: pages.ExprData.Call): ExprData {
    switch (method) {
      case 'snippet':
        return snippet(
          EntrySearch,
          1,
          new Expr(this.expr(ctx, args[0])),
          new Expr(this.expr(ctx, args[1])),
          new Expr(this.expr(ctx, args[2])),
          new Expr(this.expr(ctx, args[3]))
        )[Expr.Data]
      default:
        throw new Error(`Unknown method: "${method}"`)
    }
  }

  expr(ctx: ResolveContext, expr: pages.ExprData): ExprData {
    switch (expr.type) {
      case 'unop':
        return this.exprUnOp(ctx, expr)
      case 'binop':
        return this.exprBinOp(ctx, expr)
      case 'field':
        return this.exprField(ctx, expr)
      case 'access':
        return this.exprAccess(ctx, expr)
      case 'value':
        return this.exprValue(ctx, expr)
      case 'record':
        return this.exprRecord(ctx, expr)
      case 'case':
        return this.exprCase(ctx, expr)
      case 'call':
        return this.exprCall(ctx, expr)
    }
  }

  selectRecord(
    ctx: ResolveContext,
    {fields}: pages.Selection.Record
  ): ExprData {
    return new ExprData.Record(
      fromEntries(
        fields.flatMap(field => {
          switch (field.length) {
            case 1:
              const [target] = field
              return this.selectFieldsOf(ctx.select, target)
            case 2:
              const [key, selection] = field
              return [[key, this.select(ctx, selection)]]
          }
        })
      )
    )
  }

  selectRow(ctx: ResolveContext, {target}: pages.Selection.Row): ExprData {
    return new ExprData.Record(
      fromEntries(this.selectFieldsOf(ctx.select, target))
    )
  }

  selectCursor(
    ctx: ResolveContext,
    selection: pages.Selection.Cursor
  ): ExprData {
    return new ExprData.Query(this.queryCursor(ctx, selection))
  }

  selectExpr(
    ctx: ResolveContext,
    {expr, fromParent}: pages.Selection.Expr
  ): ExprData {
    ctx = fromParent ? ctx.decreaseDepth() : ctx
    return this.expr(ctx.select, expr)
  }

  selectCount(): ExprData {
    return sqlCount()[Expr.Data]
  }

  selectAll(ctx: ResolveContext, target: pages.TargetData): ExprData {
    const fields = this.selectFieldsOf(ctx.select, target)
    return new ExprData.Record(fromEntries(fields))
  }

  select(ctx: ResolveContext, selection: pages.Selection): ExprData {
    switch (selection.type) {
      case 'cursor':
        return this.selectCursor(ctx, selection)
      case 'row':
        return this.selectRow(ctx, selection)
      case 'record':
        return this.selectRecord(ctx, selection)
      case 'expr':
        return this.selectExpr(ctx, selection)
      case 'count':
        return this.selectCount()
    }
  }

  queryRecord(
    ctx: ResolveContext,
    selection: pages.Selection.Record
  ): QueryData.Select {
    const expr = this.selectRecord(ctx.select, selection)
    return new QueryData.Select({
      selection: expr,
      singleResult: true
    })
  }

  querySource(
    ctx: ResolveContext,
    source: pages.CursorSource | undefined,
    hasSearch: boolean
  ): Select<Table.Select<EntryTable>> {
    const cursor = hasSearch
      ? EntrySearch()
          .innerJoin(
            ctx.Table,
            ctx.Table().get('rowid').is(EntrySearch().get('rowid'))
          )
          .select(ctx.Table)
      : ctx.Table()
    if (!source) return cursor.orderBy(ctx.Table.index.asc())
    const from = EntryRow().as(`E${ctx.depth - 1}`) // .as(source.id)
    switch (source.type) {
      case SourceType.Parent:
        return cursor.where(ctx.Table.entryId.is(from.parent)).take(1)
      case SourceType.Next:
        return cursor
          .where(ctx.Table.parent.is(from.parent))
          .where(ctx.Table.index.isGreater(from.index))
          .take(1)
      case SourceType.Previous:
        return cursor
          .where(ctx.Table.parent.is(from.parent))
          .where(ctx.Table.index.isLess(from.index))
          .take(1)
      case SourceType.Siblings:
        return cursor
          .where(ctx.Table.parent.is(from.parent))
          .where(
            source.includeSelf ? true : ctx.Table.entryId.isNot(from.entryId)
          )
      case SourceType.Translations:
        return cursor
          .where(ctx.Table.i18nId.is(from.i18nId))
          .where(
            source.includeSelf ? true : ctx.Table.entryId.isNot(from.entryId)
          )
      case SourceType.Children:
        const Child = EntryRow().as('Child')
        const children = withRecursive(
          Child({entryId: from.entryId})
            .where(
              this.conditionRealm(Child, ctx.realm),
              this.conditionLocale(Child, ctx.locale)
            )
            .select({
              entryId: Child.entryId,
              parent: Child.parent,
              level: 0
            })
        ).unionAll(() =>
          Child()
            .select({
              entryId: Child.entryId,
              parent: Child.parent,
              level: children.level.add(1)
            })
            .innerJoin(children({entryId: Child.parent}))
            .where(
              this.conditionRealm(Child, ctx.realm),
              this.conditionLocale(Child, ctx.locale),
              children.level.isLess(
                Math.min(source.depth ?? MAX_DEPTH, MAX_DEPTH)
              )
            )
        )
        const childrenIds = children().select(children.entryId).skip(1)
        return cursor
          .where(ctx.Table.entryId.isIn(childrenIds))
          .orderBy(ctx.Table.index.asc())
      case SourceType.Parents:
        const Parent = EntryRow().as('Parent')
        const parents = withRecursive(
          Parent({entryId: from.entryId})
            .where(
              this.conditionRealm(Parent, ctx.realm),
              this.conditionLocale(Parent, ctx.locale)
            )
            .select({
              entryId: Parent.entryId,
              parent: Parent.parent,
              level: 0
            })
        ).unionAll(() =>
          Parent()
            .select({
              entryId: Parent.entryId,
              parent: Parent.parent,
              level: parents.level.add(1)
            })
            .innerJoin(parents({parent: Parent.entryId}))
            .where(
              this.conditionRealm(Parent, ctx.realm),
              this.conditionLocale(Parent, ctx.locale),
              parents.level.isLess(
                Math.min(source.depth ?? MAX_DEPTH, MAX_DEPTH)
              )
            )
        )
        const parentIds = parents().select(parents.entryId).skip(1)
        return cursor
          .where(ctx.Table.entryId.isIn(parentIds))
          .orderBy(ctx.Table.level.asc())
      default:
        throw unreachable(source.type)
    }
  }

  orderBy(ctx: ResolveContext, orderBy: Array<pages.OrderBy>): Array<OrderBy> {
    return orderBy.map(({expr, order}) => {
      const exprData = this.expr(ctx, expr)
      return {
        expr: exprData,
        order: order === 'Desc' ? OrderDirection.Desc : OrderDirection.Asc
      }
    })
  }

  conditionLocale(Table: Table<EntryTable>, locale?: string) {
    if (!locale) return Expr.value(true)
    return Table.locale.is(locale)
  }

  conditionRealm(Table: Table<EntryTable>, realm: Realm) {
    switch (realm) {
      case Realm.Published:
        return Table.phase.is(EntryPhase.Published)
      case Realm.Draft:
        return Table.phase.is(EntryPhase.Draft)
      case Realm.Archived:
        return Table.phase.is(EntryPhase.Archived)
      case Realm.PreferDraft:
        return Table.active
      case Realm.PreferPublished:
        return Table.main
      case Realm.All:
        return Expr.value(true)
    }
  }

  conditionLocation(Table: Table<EntryTable>, location: Array<string>) {
    switch (location.length) {
      case 1:
        return Table.workspace.is(location[0])
      case 2:
        return Table.workspace.is(location[0]).and(Table.root.is(location[1]))
      case 3:
        const condition = Table.workspace
          .is(location[0])
          .and(Table.root.is(location[1]))
          .and(Table.parentDir.like(`/${location[2]}%`))
        return condition
      default:
        return Expr.value(true)
    }
  }

  conditionSearch(Table: Table<EntryTable>, searchTerms?: Array<string>) {
    if (!searchTerms?.length) return Expr.value(true)
    const terms = searchTerms
      .map(term => `"${term.replaceAll('"', '')}"*`)
      .join(' + ')
    return match(EntrySearch, terms)
  }

  queryCursor(
    ctx: ResolveContext,
    {cursor}: pages.Selection.Cursor
  ): QueryData.Select {
    const {
      target,
      where,
      skip,
      take,
      orderBy,
      groupBy,
      select,
      first,
      source,
      searchTerms
    } = cursor
    ctx = ctx.increaseDepth().none
    const {name} = target || {}
    const hasSearch = Boolean(searchTerms?.length)
    let query = this.querySource(ctx, source, hasSearch)
    let preCondition = query[Query.Data].where
    let condition = Expr.and(
      preCondition ? new Expr(preCondition) : Expr.value(true),
      name ? ctx.Table.type.is(name) : Expr.value(true),
      this.conditionLocation(ctx.Table, ctx.location),
      this.conditionRealm(ctx.Table, ctx.realm),
      source?.type === SourceType.Translations
        ? Expr.value(true)
        : this.conditionLocale(ctx.Table, ctx.locale),
      this.conditionSearch(ctx.Table, searchTerms)
    )
    if (skip) query = query.skip(skip)
    if (take) query = query.take(take)
    const extra: Partial<QueryData.Select> = {}
    extra.where = (
      where
        ? condition.and(new Expr(this.expr(ctx.condition, where)))
        : condition
    )[Expr.Data]
    extra.selection = select
      ? this.select(ctx.select, select)
      : this.selectAll(ctx, {name})
    if (first) extra.singleResult = true
    if (groupBy) extra.groupBy = groupBy.map(expr => this.expr(ctx, expr))
    if (searchTerms) extra.orderBy = [bm25(EntrySearch, 20, 1).asc()]
    else if (orderBy) extra.orderBy = this.orderBy(ctx, orderBy)
    return query[Query.Data].with(extra)
  }

  query(ctx: ResolveContext, selection: pages.Selection): QueryData.Select {
    switch (selection.type) {
      case 'cursor':
        return this.queryCursor(ctx, selection)
      case 'record':
        return this.queryRecord(ctx, selection)
      case 'row':
      case 'count':
      case 'expr':
        throw new Error(`Cannot select ${selection.type} at root level`)
    }
  }

  async postRow(
    ctx: PostContext,
    interim: Interim,
    {target}: pages.Selection.Row
  ): Promise<void> {
    await this.postFieldsOf(ctx, interim, target)
  }

  async postCursor(
    ctx: PostContext,
    interim: Interim,
    {cursor}: pages.Selection.Cursor
  ): Promise<void> {
    const {target = {}, select, first} = cursor
    if (select) {
      if (first) await this.post(ctx, interim, select)
      else
        await Promise.all(
          interim.map((row: Interim) => this.post(ctx, row, select))
        )
    } else {
      if (first) await this.postFieldsOf(ctx, interim, target)
      else
        await Promise.all(
          interim.map((row: Interim) => this.postFieldsOf(ctx, row, target))
        )
    }
  }

  async postField(
    ctx: PostContext,
    interim: Interim,
    {target, field}: pages.ExprData.Field
  ): Promise<void> {
    const {name} = target
    if (!name) return
    const type = this.schema[name]
    if (!type) return
    const shape = Field.shape(Type.field(type, field)!)
    await shape.applyLinks(interim, ctx.linkResolver)
  }

  async postExpr(
    ctx: PostContext,
    interim: Interim,
    {expr}: pages.Selection.Expr
  ): Promise<void> {
    if (expr.type === 'field') await this.postField(ctx, interim, expr)
  }

  async postFieldsOf(
    ctx: PostContext,
    interim: Interim,
    target: pages.TargetData
  ): Promise<void> {
    if (!interim) return
    const {name} = target
    if (!name) return
    const type = this.schema[name]
    if (!type) return
    await Promise.all(
      keys(type).map(field => {
        return this.postField(ctx, interim[field], {
          type: 'field',
          target,
          field
        })
      })
    )
  }

  async postRecord(
    ctx: PostContext,
    interim: Interim,
    {fields}: pages.Selection.Record
  ): Promise<void> {
    if (!interim) return
    const tasks = []
    for (const field of fields) {
      switch (field.length) {
        case 1:
          const [target] = field
          tasks.push(this.postFieldsOf(ctx, interim, target))
          continue
        case 2:
          const [key, selection] = field
          tasks.push(this.post(ctx, interim[key], selection))
          continue
      }
    }
    await Promise.all(tasks)
  }

  post(
    ctx: PostContext,
    interim: Interim,
    selection: pages.Selection
  ): Promise<void> {
    switch (selection.type) {
      case 'row':
        return this.postRow(ctx, interim, selection)
      case 'cursor':
        return this.postCursor(ctx, interim, selection)
      case 'record':
        return this.postRecord(ctx, interim, selection)
      case 'expr':
        return this.postExpr(ctx, interim, selection)
      case 'count':
        return Promise.resolve()
    }
  }

  resolve = async <T>({
    selection,
    location,
    locale,
    realm = this.defaults?.realm ?? Realm.Published,
    preview = this.defaults?.preview
  }: ResolveRequest): Promise<T> => {
    const ctx = new ResolveContext({realm, location, locale})
    const queryData = this.query(ctx, selection)
    const query = new Query<Interim>(queryData)
    if (preview) {
      const updated =
        'entry' in preview ? preview.entry : await this.parsePreview?.(preview)
      if (updated)
        try {
          await this.db.store.transaction(async tx => {
            const current = EntryRow({
              entryId: updated.entryId,
              active: true
            })
            // Temporarily add preview entry
            await tx(current.delete())
            await tx(EntryRow().insert(updated))
            await Database.index(tx)
            const result = await tx(query)
            const linkResolver = new LinkResolver(this, tx, ctx.realm)
            if (result) await this.post({linkResolver}, result, selection)
            // The transaction api needs to be revised to support explicit commit/rollback
            throw {result}
          })
        } catch (err: any) {
          if (err.result) return err.result
          // console.warn('Could not decode preview update', err)
        }
    }
    return this.db.store.transaction(async tx => {
      const result = await tx(query)
      const linkResolver = new LinkResolver(this, tx, ctx.realm)
      if (result) await this.post({linkResolver}, result, selection)
      return result
    })
  }
}
