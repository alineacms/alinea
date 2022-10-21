import type {Collection} from './Collection'
import {EV, Expr, ExprData} from './Expr'
import {Fields} from './Fields'
import {From} from './From'
import type {OrderBy} from './OrderBy'
import {Selection, SelectionInput} from './Selection'
import type {Store} from './Store'

export type CursorData = {
  from: From
  selection: ExprData
  where?: ExprData
  having?: ExprData
  limit?: number
  offset?: number
  orderBy?: Array<OrderBy>
  groupBy?: Array<ExprData>
  singleResult?: boolean
  union?: CursorData
}

export class CursorImpl<Row> {
  constructor(public cursor: CursorData) {
    return new Proxy(this, {
      get(target: any, key) {
        return key in target ? target[key] : target.get(key)
      }
    })
  }

  get(name: string): Expr<any> {
    return new Expr(ExprData.Field(this.cursor.selection, name as string))
  }

  get fields(): Selection<Row> {
    return new Selection<Row>(this.cursor.selection)
  }

  leftJoin<T>(that: Collection<T>, on: Expr<boolean>): CursorImpl<Row> {
    const condition = that.cursor.where
      ? on.and(new Expr(that.cursor.where))
      : on
    return new CursorImpl<Row>({
      ...this.cursor,
      from: From.Join(
        this.cursor.from,
        that.cursor.from,
        'left',
        condition.expr
      )
    })
  }

  innerJoin<T>(that: Collection<T>, on: Expr<boolean>): CursorImpl<Row> {
    const condition = that.cursor.where
      ? on.and(new Expr(that.cursor.where))
      : on
    return new CursorImpl<Row>({
      ...this.cursor,
      from: From.Join(
        this.cursor.from,
        that.cursor.from,
        'inner',
        condition.expr
      )
    })
  }

  take(limit: number | undefined): CursorImpl<Row> {
    return new CursorImpl<Row>({...this.cursor, limit})
  }

  skip(offset: number | undefined): CursorImpl<Row> {
    return new CursorImpl<Row>({...this.cursor, offset})
  }

  first(): CursorSingleRow<Row> {
    return new CursorSingleRow<Row>(this.take(1).cursor)
  }

  where(
    where: EV<boolean> | ((collection: Fields<Row>) => EV<boolean>)
  ): CursorImpl<Row> {
    const condition = Expr.create(
      typeof where === 'function' ? where(this as any) : where
    )
    return new CursorImpl<Row>({
      ...this.cursor,
      where: (this.cursor.where
        ? condition.and(new Expr(this.cursor.where))
        : condition
      ).expr
    })
  }

  select<
    X extends SelectionInput | ((collection: Cursor<Row>) => SelectionInput)
  >(selection: X) {
    return new CursorImpl<Store.TypeOf<X>>({
      ...this.cursor,
      selection:
        typeof selection === 'function'
          ? Selection.create(selection(this as any))
          : Selection.create(selection)
    })
  }

  having(having: Expr<boolean>): CursorImpl<Row> {
    return new CursorImpl<Row>({
      ...this.cursor,
      having: (this.cursor.having
        ? having.and(new Expr(this.cursor.having))
        : having
      ).expr
    })
  }

  with<S extends SelectionInput>(selection: S): Selection.With<Row, S> {
    return new Selection<Row>(this.cursor.selection).with<S>(selection)
  }

  include<I extends SelectionInput>(
    selection: I
  ): CursorImpl<Omit<Row, keyof Store.TypeOf<I>> & Store.TypeOf<I>> {
    return this.select(this.with(selection))
  }

  union(that: CursorImpl<Row>): CursorImpl<Row> {
    return new CursorImpl<Row>({
      ...this.cursor,
      union: that.cursor
    })
  }

  orderBy(...orderBy: Array<OrderBy>): CursorImpl<Row>
  orderBy(pick: (collection: Fields<Row>) => Array<OrderBy>): CursorImpl<Row>
  orderBy(...args: Array<any>): CursorImpl<Row> {
    const orderBy: Array<OrderBy> =
      args.length === 1 && typeof args[0] === 'function' ? args[0](this) : args
    return new CursorImpl<Row>({
      ...this.cursor,
      orderBy: orderBy
    })
  }

  groupBy(...groupBy: Array<Expr<any>>): CursorImpl<Row>
  groupBy(pick: (collection: Fields<Row>) => Array<Expr<any>>): CursorImpl<Row>
  groupBy(...args: Array<any>): CursorImpl<Row> {
    const groupBy: Array<Expr<any>> =
      args.length === 1 && typeof args[0] === 'function' ? args[0](this) : args
    const data = groupBy.map(e => e.expr)
    return new CursorImpl<Row>({
      ...this.cursor,
      groupBy: data
    })
  }

  toExpr(): Expr<Row> {
    return new Expr<Row>(ExprData.create(this))
  }

  toJSON() {
    return this.cursor
  }
}

export class CursorSingleRow<Row> extends CursorImpl<Row> {
  __bogus: undefined
  constructor(cursor: CursorData) {
    super({...cursor, singleResult: true})
  }
}

// Source: https://stackoverflow.com/a/61625831/5872160
type IsStrictlyAny<T> = (T extends never ? true : false) extends false
  ? false
  : true

export interface CursorConstructor {
  new <Row>(cursor: CursorData): Cursor<Row>
}
export type Cursor<T> = IsStrictlyAny<T> extends true
  ? CursorImpl<T>
  : CursorImpl<T> & Fields<T>
export const Cursor = CursorImpl as CursorConstructor
