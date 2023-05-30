import {
  Connection,
  Field,
  RichTextShape,
  Schema,
  Shape,
  TextDoc,
  Type,
  createYDoc,
  parseYDoc
} from 'alinea/core'
import {Realm} from 'alinea/core/pages/Realm'
import {base64} from 'alinea/core/util/Encoding'
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
import * as Y from 'yjs'
import {Entry, EntryPhase, EntryTable} from '../core/Entry.js'
import * as pages from '../core/pages/index.js'
import {Store} from './Store.js'

const {keys, entries, fromEntries} = Object

const unOps = {
  [pages.UnaryOp.Not]: UnOpType.Not,
  [pages.UnaryOp.IsNull]: UnOpType.IsNull
}

const binOps = {
  [pages.BinaryOp.Add]: BinOpType.Add,
  [pages.BinaryOp.Subt]: BinOpType.Subt,
  [pages.BinaryOp.Mult]: BinOpType.Mult,
  [pages.BinaryOp.Mod]: BinOpType.Mod,
  [pages.BinaryOp.Div]: BinOpType.Div,
  [pages.BinaryOp.Greater]: BinOpType.Greater,
  [pages.BinaryOp.GreaterOrEqual]: BinOpType.GreaterOrEqual,
  [pages.BinaryOp.Less]: BinOpType.Less,
  [pages.BinaryOp.LessOrEqual]: BinOpType.LessOrEqual,
  [pages.BinaryOp.Equals]: BinOpType.Equals,
  [pages.BinaryOp.NotEquals]: BinOpType.NotEquals,
  [pages.BinaryOp.And]: BinOpType.And,
  [pages.BinaryOp.Or]: BinOpType.Or,
  [pages.BinaryOp.Like]: BinOpType.Like,
  [pages.BinaryOp.In]: BinOpType.In,
  [pages.BinaryOp.NotIn]: BinOpType.NotIn,
  [pages.BinaryOp.Concat]: BinOpType.Concat
}

const pageFields = keys(Entry)

class QueryContext {
  constructor(
    public realm: Realm,
    public table: Table<EntryTable> | undefined = undefined,
    public expr: ExprContext = ExprContext.InNone
  ) {}

  get Table() {
    if (!this.table) throw new Error(`Cannot select without a table reference`)
    return this.table
  }

  withTable(table: Table<EntryTable>): QueryContext {
    return new QueryContext(this.realm, table, this.expr)
  }

  get inSelect() {
    return this.expr & ExprContext.InSelect
  }

  get inCondition() {
    return this.expr & ExprContext.InCondition
  }

  get inAccess() {
    return this.expr & ExprContext.InAccess
  }

  get select(): QueryContext {
    if (this.inSelect) return this
    return new QueryContext(
      this.realm,
      this.table,
      this.expr | ExprContext.InSelect
    )
  }

  get condition(): QueryContext {
    if (this.inCondition) return this
    return new QueryContext(
      this.realm,
      this.table,
      this.expr | ExprContext.InCondition
    )
  }

  get access(): QueryContext {
    if (this.inAccess) return this
    return new QueryContext(
      this.realm,
      this.table,
      this.expr | ExprContext.InAccess
    )
  }

  get none(): QueryContext {
    return new QueryContext(this.realm, this.table, ExprContext.InNone)
  }
}

enum ExprContext {
  InNone = 0,
  InSelect = 1 << 0,
  InCondition = 1 << 1,
  InAccess = 1 << 2
}

const POST_KEY = '$$post'

type Pre = {
  [POST_KEY]: 'richText'
  doc: TextDoc<any>
  linked: Array<{id: string; url: string}>
}

export class Resolver {
  constructor(public store: Store, public schema: Schema) {}

  fieldExpr(ctx: QueryContext, expr: ExprData, shape: Shape): ExprData {
    if (ctx.inAccess || ctx.inCondition) return expr
    switch (true) {
      case shape instanceof RichTextShape:
        if (ctx.inAccess || ctx.inCondition)
          return new ExprData.Field(expr, 'doc')
        return new ExprData.Record({
          [POST_KEY]: new ExprData.Param(new ParamData.Value('richText')),
          doc: new ExprData.Field(expr, 'doc'),
          linked: new ExprData.Query(
            Entry(
              Entry.entryId.isIn(new Expr(new ExprData.Field(expr, 'linked')))
            ).select({
              id: Entry.entryId,
              url: Entry.url
            })[Query.Data]
          )
        })
      default:
        return expr
    }
  }

  fieldOf(
    ctx: QueryContext,
    target: pages.TargetData,
    field: string
  ): ExprData {
    // Todo: we should make this non-ambiguous
    // Todo: userland should never be able to query phase field
    switch (field) {
      case 'id':
      case 'entryId':
        return ctx.Table.entryId[Expr.Data]
      case 'type':
        return ctx.Table.type[Expr.Data]
      case 'url':
        return ctx.Table.url[Expr.Data]
      case 'title':
        return ctx.Table.title[Expr.Data]
      case 'path':
        return ctx.Table.path[Expr.Data]
      case 'index':
        return ctx.Table.index[Expr.Data]
      default:
        const {name} = target
        if (!name) {
          const fields: Record<string, Expr<any>> = ctx.Table as any
          if (field in fields) return fields[field][Expr.Data]
          throw new Error(`Selecting unknown field: "${field}"`)
        }
        const type = this.schema[name]
        if (!type)
          throw new Error(`Selecting "${field}" from unknown type: "${name}"`)
        return this.fieldExpr(
          ctx,
          ctx.Table.data.get(field)[Expr.Data],
          Field.shape(Type.field(type, field)!)
        )
    }
  }

  pageFields(ctx: QueryContext): Array<[string, ExprData]> {
    return pageFields.map(key => [key, this.fieldOf(ctx, {}, key)])
  }

  fieldsOf(
    ctx: QueryContext,
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

  exprUnOp(ctx: QueryContext, {op, expr}: pages.ExprData.UnOp): ExprData {
    return new ExprData.UnOp(unOps[op], this.expr(ctx, expr))
  }

  exprBinOp(ctx: QueryContext, {op, a, b}: pages.ExprData.BinOp): ExprData {
    return new ExprData.BinOp(binOps[op], this.expr(ctx, a), this.expr(ctx, b))
  }

  exprField(
    ctx: QueryContext,
    {target, field}: pages.ExprData.Field
  ): ExprData {
    return this.fieldOf(ctx, target, field)
  }

  exprAccess(
    ctx: QueryContext,
    {expr, field}: pages.ExprData.Access
  ): ExprData {
    return new ExprData.Field(this.expr(ctx.access, expr), field)
  }

  exprValue(ctx: QueryContext, {value}: pages.ExprData.Value): ExprData {
    return new ExprData.Param(new ParamData.Value(value))
  }

  exprRecord(ctx: QueryContext, {fields}: pages.ExprData.Record): ExprData {
    return new ExprData.Record(
      fromEntries(
        entries(fields).map(([key, expr]) => {
          return [key, this.expr(ctx, expr)]
        })
      )
    )
  }

  expr(ctx: QueryContext, expr: pages.ExprData): ExprData {
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
    }
  }

  selectRecord(ctx: QueryContext, {fields}: pages.Selection.Record): ExprData {
    return new ExprData.Record(
      fromEntries(
        fields.flatMap(field => {
          switch (field.length) {
            case 1:
              const [target] = field
              return this.fieldsOf(ctx.select, target)
            case 2:
              const [key, selection] = field
              return [[key, this.select(ctx, selection)]]
          }
        })
      )
    )
  }

  selectRow(ctx: QueryContext, {target}: pages.Selection.Row): ExprData {
    return new ExprData.Record(fromEntries(this.fieldsOf(ctx.select, target)))
  }

  selectCursor(ctx: QueryContext, selection: pages.Selection.Cursor): ExprData {
    return new ExprData.Query(this.queryCursor(ctx, selection))
  }

  selectExpr(ctx: QueryContext, {expr}: pages.Selection.Expr): ExprData {
    return this.expr(ctx.select, expr)
  }

  selectAll(ctx: QueryContext, target: pages.TargetData): ExprData {
    const fields = this.fieldsOf(ctx.select, target)
    return new ExprData.Record(fromEntries(fields))
  }

  select(ctx: QueryContext, selection: pages.Selection): ExprData {
    switch (selection.type) {
      case 'cursor':
        return this.selectCursor(ctx, selection)
      case 'row':
        return this.selectRow(ctx, selection)
      case 'record':
        return this.selectRecord(ctx, selection)
      case 'expr':
        return this.selectExpr(ctx, selection)
    }
  }

  queryRecord(
    ctx: QueryContext,
    selection: pages.Selection.Record
  ): QueryData.Select {
    const expr = this.selectRecord(ctx.select, selection)
    return new QueryData.Select({
      selection: expr,
      singleResult: true
    })
  }

  querySource(
    ctx: QueryContext,
    source: pages.CursorSource | undefined
  ): Select<Table.Select<EntryTable>> {
    if (!source) return ctx.Table()
    const from = Entry().as(source.id)
    switch (source.type) {
      case pages.SourceType.Parent:
        return ctx.Table().where(ctx.Table.entryId.is(from.parent)).take(1)
      case pages.SourceType.Children:
        const Child = Entry().as('Child')
        const children = withRecursive(
          Child({entryId: from.entryId})
            .where(this.restrictRealm(Child, ctx.realm))
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
              this.restrictRealm(Child, ctx.realm),
              children.level.isLess(source.depth)
            )
        )
        const childrenIds = children().select(children.entryId).skip(1)
        return ctx
          .Table()
          .where(ctx.Table.entryId.isIn(childrenIds))
          .orderBy(ctx.Table.index.asc())
      case pages.SourceType.Parents:
        const Parent = Entry().as('Parent')
        const parents = withRecursive(
          Parent({entryId: from.entryId})
            .where(this.restrictRealm(Parent, ctx.realm))
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
              this.restrictRealm(Parent, ctx.realm),
              source.depth ? children.level.isLess(source.depth) : true
            )
        )
        const parentIds = parents().select(parents.entryId).skip(1)
        return ctx
          .Table()
          .where(ctx.Table.entryId.isIn(parentIds))
          .orderBy(ctx.Table.level.asc())
      default:
        throw new Error(`Todo`)
    }
  }

  orderBy(ctx: QueryContext, orderBy: Array<pages.OrderBy>): Array<OrderBy> {
    return orderBy.map(({expr, order}) => {
      const exprData = this.expr(ctx, expr)
      return {
        expr: exprData,
        order: order === 'Desc' ? OrderDirection.Desc : OrderDirection.Asc
      }
    })
  }

  restrictRealm(Table: Table<EntryTable>, realm: Realm) {
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

  queryCursor(
    ctx: QueryContext,
    {cursor}: pages.Selection.Cursor
  ): QueryData.Select {
    const {
      id,
      target,
      where,
      skip,
      take,
      orderBy,
      groupBy,
      select,
      first,
      source
    } = cursor
    ctx = ctx.withTable(Entry().as(id)).none
    const {name} = target || {}
    let query = this.querySource(ctx, source)
    let preCondition = query[Query.Data].where
    let condition = Expr.and(
      preCondition ? new Expr(preCondition) : Expr.value(true),
      name ? ctx.Table.type.is(name) : Expr.value(true),
      this.restrictRealm(ctx.Table, ctx.realm)
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
    if (orderBy) extra.orderBy = this.orderBy(ctx, orderBy)
    return query[Query.Data].with(extra)
  }

  query(ctx: QueryContext, selection: pages.Selection): QueryData.Select {
    switch (selection.type) {
      case 'row':
        throw new Error(`Cannot select rows at root level`)
      // return this.queryRow(selection)
      case 'cursor':
        return this.queryCursor(ctx, selection)
      case 'record':
        return this.queryRecord(ctx, selection)
      case 'expr':
        throw new Error(`Cannot select expressions at root level`)
    }
  }

  postProcess(pre: Pre) {
    switch (pre[POST_KEY]) {
      case 'richText':
        const {doc, linked} = pre
        // Todo: add href into text doc
        return doc
      default:
        return pre
    }
  }

  post(interim: object): any {
    if (!interim) return interim
    if (Array.isArray(interim)) {
      return interim.map(item => this.post(item))
    }
    if (typeof interim === 'object') {
      if (POST_KEY in interim) return this.postProcess(interim as any)
      return fromEntries(
        entries(interim).map(([key, value]) => {
          return [key, this.post(value)]
        })
      )
    }
    return interim
  }

  resolve = async <T>({
    selection,
    realm = Realm.Published,
    preview
  }: Connection.ResolveParams): Promise<T> => {
    const query = new Query<object | Array<object>>(
      this.query(new QueryContext(realm), selection)
    )
    let interim: object | Array<object>
    if (preview) {
      const current = Entry({
        entryId: preview.entryId,
        phase: preview.phase
      })
      const entry = await this.store(current.maybeFirst())
      if (entry)
        try {
          // Create yjs doc
          const type = this.schema[entry.type]
          const yDoc = createYDoc(type, entry)
          // Apply update
          const update = base64.parse(preview.update)
          Y.applyUpdateV2(yDoc, update)
          const entryData = parseYDoc(type, yDoc)
          const previewEntry = {...entry, ...entryData}
          await this.store.transaction(async tx => {
            // Temporarily add preview entry
            await tx(current.delete())
            await tx(Entry().insert(previewEntry))
            const result = await tx(query)
            // The transaction api needs to be revised to support explicit commit/rollback
            throw {result}
          })
        } catch (err: any) {
          if (err.result) interim = err.result
          else throw err
        }
    } else {
      interim = await this.store(query)
    }
    return this.post(interim!)
  }
}
