import type {Collection} from './Collection'
import {EV, Expr, ExprData} from './Expr'
import {From} from './From'
import type {OrderBy} from './OrderBy'
import {SelectionData, SelectionInput} from './Selection'
import type {Store} from './Store'

export type CursorData = {
  from: From
  selection: SelectionData
  where?: ExprData
  having?: ExprData
  limit?: number
  offset?: number
  orderBy?: Array<OrderBy>
  groupBy?: Array<ExprData>
  singleResult?: boolean
}

export class Cursor<Row> {
  constructor(public cursor: CursorData) {}

  join(that: Collection<any>, on: Expr<boolean>): Cursor<Row> {
    const condition = that.cursor.where
      ? on.and(new Expr(that.cursor.where))
      : on
    return new Cursor({
      ...this.cursor,
      from: From.Join(
        this.cursor.from,
        that.cursor.from,
        'left',
        condition.expr
      )
    })
  }

  get<K extends string>(name: K): Expr<K extends keyof Row ? Row[K] : any> {
    return new Expr(ExprData.Field(this.cursor.from, name as string))
  }

  innerJoin(that: Collection<any>, on: Expr<boolean>): Cursor<Row> {
    const condition = that.cursor.where
      ? on.and(new Expr(that.cursor.where))
      : on
    return new Cursor({
      ...this.cursor,
      from: From.Join(
        this.cursor.from,
        that.cursor.from,
        'inner',
        condition.expr
      )
    })
  }

  take(limit: number | undefined): Cursor<Row> {
    return new Cursor({...this.cursor, limit})
  }

  skip(offset: number | undefined): Cursor<Row> {
    return new Cursor({...this.cursor, offset})
  }

  first(): CursorSingleRow<Row> {
    return new CursorSingleRow(this.take(1).cursor)
  }

  where(where: EV<boolean>): Cursor<Row> {
    const condition = Expr.create(where)
    return new Cursor({
      ...this.cursor,
      where: (this.cursor.where
        ? condition.and(new Expr(this.cursor.where))
        : condition
      ).expr
    })
  }

  select<X extends SelectionInput>(selection: X) {
    return new Cursor<Store.TypeOf<X>>({
      ...this.cursor,
      selection: SelectionData.create(selection)
    })
  }

  having(having: Expr<boolean>): Cursor<Row> {
    return new Cursor({
      ...this.cursor,
      having: (this.cursor.having
        ? having.and(new Expr(this.cursor.having))
        : having
      ).expr
    })
  }

  /*with<S extends SelectionInput>(selection: S) {
    return new Cursor<Omit<Row, keyof Store.TypeOf<S>> & Store.TypeOf<S>>({
      ...this.cursor,
      selection: new Selection(this.cursor.selection).with(selection).selection
    })
  }*/

  orderBy(...orderBy: Array<OrderBy>): Cursor<Row> {
    return new Cursor({
      ...this.cursor,
      orderBy: this.cursor.orderBy
        ? this.cursor.orderBy.concat(orderBy)
        : orderBy
    })
  }

  groupBy(...groupBy: Array<Expr<any>>): Cursor<Row> {
    const data = groupBy.map(e => e.expr)
    return new Cursor({
      ...this.cursor,
      groupBy: this.cursor.groupBy ? this.cursor.groupBy.concat(data) : data
    })
  }

  toJSON() {
    return this.cursor
  }
}

export class CursorSingleRow<Row> extends Cursor<Row> {
  __bogus: undefined
  constructor(cursor: CursorData) {
    super({...cursor, singleResult: true})
  }
}
