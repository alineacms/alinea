import type {Collection} from './Collection'
import {Expr, ExprData} from './Expr'
import {From} from './From'
import type {OrderBy} from './OrderBy'
import {SelectionData} from './Selection'

export type CursorData = {
  from: From
  selection: SelectionData
  where?: ExprData
  limit?: number
  offset?: number
  orderBy?: Array<OrderBy>
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
      // c.collections.set(Collection.getName(that), that);
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
      // c.collections.set(Collection.getName(that), that);
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

  select<T>(selection: T): Cursor<T> {
    return new Cursor({
      ...this.cursor,
      selection: SelectionData.create(selection)
    })
  }

  orderBy(...orderBy: Array<OrderBy>) {
    return new Cursor({
      ...this.cursor,
      orderBy: this.cursor.orderBy
        ? this.cursor.orderBy.concat(orderBy)
        : orderBy
    })
  }

  toJSON() {
    return this.cursor
  }
}

class CursorSingleRow<Row> extends Cursor<Row> {}
