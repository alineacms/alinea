import {array, boolean, enums, number, object, string, tuple} from 'cito'
import {Expr, ExprData} from './Expr.js'
import {Projection} from './Projection.js'
import {Selection} from './Selection.js'
import {TargetData} from './Target.js'

export type CursorData = typeof CursorData.infer
export const CursorData = object(
  class {
    id = string
    target? = TargetData.optional
    where? = ExprData.adt.optional
    skip? = number.optional
    take? = number.optional
    orderBy? = array(ExprData.adt).optional
    select? = Selection.adt.optional
    first? = boolean.optional
    source? = tuple(enums(SourceType), string).optional
  }
)

export enum SourceType {
  Children = 'Children',
  Siblings = 'Siblings',
  Parents = 'Parents',
  Parent = 'Parent',
  Next = 'Next',
  Previous = 'Previous'
}

export interface Cursor<T> {
  [Cursor.Data]: CursorData
}

declare const brand: unique symbol
export class Cursor<T> {
  declare [brand]: T

  constructor(data: CursorData) {
    this[Cursor.Data] = data
  }

  protected get id() {
    return this[Cursor.Data].id
  }

  protected with(data: Partial<CursorData>): CursorData {
    return {...this[Cursor.Data], ...data}
  }

  static isCursor<T>(input: any): input is Cursor<T> {
    const [d] = Reflect.ownKeys(input)
    return Boolean(input && input[Cursor.Data])
  }

  toJSON() {
    return this[Cursor.Data]
  }
}

export namespace Cursor {
  export const Data = Symbol.for('@alinea/Cursor.Data')

  export class Find<Row> extends Cursor<Array<Row>> {
    where(where: Expr<boolean>): Find<Row> {
      return new Find(
        this.with({
          where: where[Expr.Data]
        })
      )
    }

    get<S extends Projection<Row>>(select: S): Get<Selection.Infer<S>> {
      const query = this.with({first: true})
      if (select) query.select = Selection(select, this.id)
      return new Get<Selection.Infer<S>>(query)
    }

    first(): Get<Row> {
      return new Get<Row>(this.with({first: true}))
    }

    select<S extends Projection<Row>>(select: S): Find<Selection.Infer<S>> {
      return new Find<Selection.Infer<S>>(
        this.with({select: Selection(select, this.id)})
      )
    }
  }

  export class Get<Row> extends Cursor<Row> {
    where(where: ExprData): Get<Row> {
      return new Get<Row>(this.with({where}))
    }

    select<S extends Projection<Row>>(select: S): Get<Selection.Infer<S>> {
      return new Get<Selection.Infer<S>>(
        this.with({select: Selection(select, this.id)})
      )
    }
  }
}
