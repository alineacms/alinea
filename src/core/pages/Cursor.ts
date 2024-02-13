import {Entry} from '../Entry.js'
import type {Type} from '../Type.js'
import {entries} from '../util/Objects.js'
import {createSelection} from './CreateSelection.js'
import type {Condition} from './Expr.js'
import {EV, Expr, HasExpr, createExprData} from './Expr.js'
import type {Projection} from './Projection.js'
import {
  BinaryOp,
  CursorData,
  ExprData,
  OrderBy,
  Selection,
  SourceType,
  targetData,
  toExpr,
  toSelection
} from './ResolveData.js'
import type {TargetI} from './Target.js'

export interface Cursor<T> {
  [Cursor.Data]: CursorData
}

declare const brand: unique symbol
export class Cursor<T> implements HasExpr<boolean> {
  declare [brand]: T

  constructor(data: CursorData) {
    this[Cursor.Data] = data
  }

  protected with(data: Partial<CursorData>): CursorData {
    return {...this[Cursor.Data], ...data}
  }

  static isCursor<T>(input: any): input is Cursor<T> {
    return Boolean(input && input[Cursor.Data])
  }

  [toExpr]() {
    // Todo: this has to take target into account
    const {where} = this[Cursor.Data]
    return Expr(where ?? ExprData.Value(true))
  }

  [toSelection]() {
    return Selection.Cursor(this[Cursor.Data])
  }

  toJSON() {
    return this[Cursor.Data]
  }
}

export namespace Cursor {
  export const Data = Symbol.for('@alinea/Cursor.Data')

  export class Find<Row> extends Cursor<Array<Row>> {
    where(...where: Array<Condition | boolean>): Find<Row> {
      const current = this[Cursor.Data].where
      return new Find(
        this.with({
          where: Expr.and(current ? Expr(current) : true, ...where)[Expr.Data]
        })
      )
    }

    whereUrl(url: string): Find<Row> {
      return new Find<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'url')).is(url)[Expr.Data]
        })
      )
    }

    wherePath(path: string): Find<Row> {
      return new Find<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'path')).is(path)[Expr.Data]
        })
      )
    }

    whereParent(parentId: string): Find<Row> {
      return new Find<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'parent')).is(parentId)[Expr.Data]
        })
      )
    }

    whereLocale(locale: string): Find<Row> {
      return new Find<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'locale')).is(locale)[Expr.Data]
        })
      )
    }

    whereRoot(root: string): Find<Row> {
      return new Find<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'root')).is(root)[Expr.Data]
        })
      )
    }

    whereWorkspace(workspace: string): Find<Row> {
      return new Find<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'workspace')).is(workspace)[Expr.Data]
        })
      )
    }

    search(...searchTerms: Array<string>) {
      if (searchTerms.length === 0) return this
      return new Find<Row>(this.with({searchTerms}))
    }

    get<S extends Projection>(select: S): Get<Selection.Infer<S>> {
      const query = this.with({first: true})
      if (select) query.select = createSelection(select)
      return new Get<Selection.Infer<S>>(query)
    }

    count(): Cursor<number> {
      return new Cursor<number>(
        this.with({first: true, select: Selection.Count()})
      )
    }

    first(): Get<Row> {
      return new Get<Row>(this.with({first: true}))
    }

    maybeFirst(): Get<Row | undefined> {
      return new Get<Row | undefined>(this.with({first: true}))
    }

    select<S extends Projection>(select: S): Find<Selection.Infer<S>> {
      return new Find<Selection.Infer<S>>(
        this.with({select: createSelection(select)})
      )
    }

    groupBy(...groupBy: Array<Expr<any>>): Find<Row> {
      return new Find<Row>(this.with({groupBy: groupBy.map(createExprData)}))
    }

    orderBy(...orderBy: Array<OrderBy>): Find<Row> {
      return new Find<Row>(this.with({orderBy}))
    }

    skip(skip: number): Find<Row> {
      return new Find<Row>(this.with({skip}))
    }

    take(take: number): Find<Row> {
      return new Find<Row>(this.with({take}))
    }
  }

  export class Typed<Definition> extends Find<Type.Infer<Definition>> {
    constructor(
      public type: Type<Definition>,
      public partial: Partial<Type.Infer<Definition>> = {}
    ) {
      super({
        target: {type},
        where: Typed.condition(type, partial)
      })
    }

    where(partial: Partial<Type.Infer<Definition>>): Typed<Definition>
    where(...where: Array<EV<boolean>>): Find<Type.Infer<Definition>>
    where(...input: Array<any>): any {
      const isConditionalRecord = input.length === 1 && !Expr.isExpr(input[0])
      const current = this[Cursor.Data].where
      if (isConditionalRecord) {
        return new Typed<Definition>(this.type, {
          ...this.partial,
          ...input[0]
        })
      }
      return new Find(
        this.with({
          where: Expr.and(current ? Expr(current) : true, ...input)[Expr.Data]
        })
      )
    }

    static condition(
      type: Type,
      input: Record<string, any>
    ): ExprData | undefined {
      const conditions = entries(input || {}).map(([key, value]) => {
        const field = Expr(ExprData.Field({type}, key))
        return Expr(
          ExprData.BinOp(
            field[Expr.Data],
            BinaryOp.Equals,
            createExprData(value)
          )
        )
      })
      return Expr.and(...conditions)[Expr.Data]
    }
  }

  export class Get<Row> extends Cursor<Row> {
    where(...where: Array<EV<boolean>>): Get<Row> {
      const current = this[Cursor.Data].where
      return new Get(
        this.with({
          where: Expr.and(current ? Expr(current) : true, ...where)[Expr.Data]
        })
      )
    }

    whereUrl(url: string): Get<Row> {
      return new Get<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'url')).is(url)[Expr.Data]
        })
      )
    }

    wherePath(path: string): Get<Row> {
      return new Get<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'path')).is(path)[Expr.Data]
        })
      )
    }

    whereParent(parentId: string): Get<Row> {
      return new Get<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'parent')).is(parentId)[Expr.Data]
        })
      )
    }

    whereLocale(locale: string): Get<Row> {
      return new Get<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'locale')).is(locale)[Expr.Data]
        })
      )
    }

    whereRoot(root: string): Get<Row> {
      return new Get<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'root')).is(root)[Expr.Data]
        })
      )
    }

    whereWorkspace(workspace: string): Get<Row> {
      return new Get<Row>(
        this.with({
          where: Expr(ExprData.Field({}, 'workspace')).is(workspace)[Expr.Data]
        })
      )
    }

    search(...searchTerms: Array<string>) {
      return new Get<Row>(this.with({searchTerms}))
    }

    select<S extends Projection>(select: S): Get<Selection.Infer<S>> {
      return new Get<Selection.Infer<S>>(
        this.with({select: createSelection(select)})
      )
    }
  }
}

type Narrow = Cursor.Find<any> | TargetI<any>
type Output<T> = [Narrow] extends [T] ? Entry : Selection.Infer<T>

export class Tree {
  constructor(/*protected sourceId: string*/) {
    this.children = this.children.bind(this)
    this.parents = this.parents.bind(this)
  }

  protected narrowData(narrow?: any): Partial<CursorData> {
    return (
      narrow &&
      (Cursor.isCursor(narrow)
        ? narrow[Cursor.Data]
        : {target: narrow[targetData]})
    )
  }

  protected find<T>(
    sourceType: SourceType,
    narrow?: any,
    depth?: number
  ): Cursor.Find<T> {
    return new Cursor.Find({
      ...this.narrowData(narrow),
      source: {type: sourceType, depth}
    })
  }

  protected get<T>(sourceType: SourceType, narrow?: any): Cursor.Get<T> {
    return new Cursor.Get({
      ...this.narrowData(narrow),
      first: true,
      source: {type: sourceType}
    })
  }

  children<N extends Narrow>(depth?: number): Cursor.Find<Output<N>>
  children<N extends Narrow>(narrow?: N, depth?: number): Cursor.Find<Output<N>>
  children<N extends Narrow>(
    narrow?: N | number,
    depth?: number
  ): Cursor.Find<Output<N>> {
    ;[narrow, depth] =
      typeof narrow === 'number' ? [undefined, narrow] : [narrow, depth || 1]
    return this.find(SourceType.Children, narrow, depth)
  }
  parents<N extends Narrow>(depth?: number): Cursor.Find<Output<N>>
  parents<N extends Narrow>(narrow?: N, depth?: number): Cursor.Find<Output<N>>
  parents<N extends Narrow>(
    narrow?: N | number,
    depth?: number
  ): Cursor.Find<Output<N>> {
    ;[narrow, depth] =
      typeof narrow === 'number' ? [undefined, narrow] : [narrow, depth]
    return this.find(SourceType.Parents, narrow, depth)
  }
  previous = <N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> => {
    return this.get(SourceType.Previous, narrow)
  }
  next = <N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> => {
    return this.get(SourceType.Next, narrow)
  }
  parent = <N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> => {
    return this.get(SourceType.Parent, narrow)
  }
  siblings = <N extends Narrow>(narrow?: N): Cursor.Find<Output<N>> => {
    return this.find(SourceType.Siblings, narrow)
  }
  translations = (includeSelf = false): Cursor.Find<Entry> => {
    return this.find(SourceType.Translations)
  }
}
