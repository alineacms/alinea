import type {Collection} from './Collection'
import {Expr, ExprData} from './Expr'
import {From} from './From'
import type {OrderBy} from './OrderBy'
import {SelectionData} from './Selection'
import {Select, TypeOf} from './Types'

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

  leftJoin(that: Collection<any>, on: Expr<boolean>): Cursor<Row> {
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

  where(where: Expr<boolean>): Cursor<Row> {
    return new Cursor({
      ...this.cursor,
      where: (this.cursor.where
        ? where.and(new Expr(this.cursor.where))
        : where
      ).expr
    })
  }

  select<X extends Select>(selection: X) {
    return new Cursor<TypeOf<X>>({
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

  /*with<X extends Select>(selection: X) {
    return new Cursor<Omit<Row, keyof TypeOf<X>> & TypeOf<X>>({
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
}

export class CursorSingleRow<Row> extends Cursor<Row> {
  __bogus: undefined
  constructor(cursor: CursorData) {
    super({...cursor, singleResult: true})
  }
}
