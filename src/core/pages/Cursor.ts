import {array, boolean, enums, number, object, string} from 'cito'
import {createId} from '../Id.js'
import {Type} from '../Type.js'
import {entries} from '../util/Objects.js'
import {BinaryOp, Expr, ExprData, and} from './Expr.js'
import {Projection} from './Projection.js'
import {Selection} from './Selection.js'
import {TargetData} from './Target.js'

export enum OrderDirection {
  Asc = 'Asc',
  Desc = 'Desc'
}

export type OrderBy = typeof OrderBy.infer
export const OrderBy = object(
  class {
    expr = ExprData.adt
    order = enums(OrderDirection)
  }
)

export type CursorData = typeof CursorData.infer
export const CursorData = object(
  class {
    id = string
    target? = TargetData.optional
    where? = ExprData.adt.optional
    searchTerms? = array(string).optional
    skip? = number.optional
    take? = number.optional
    orderBy? = array(OrderBy).optional
    groupBy? = array(ExprData.adt).optional
    select? = Selection.adt.optional
    first? = boolean.optional
    source? = CursorSource.optional
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

export type CursorSource = typeof CursorSource.infer
export const CursorSource = object(
  class {
    type = enums(SourceType)
    id = string
    depth? = number.optional
  }
)

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
    return Boolean(input && input[Cursor.Data])
  }

  toJSON() {
    return this[Cursor.Data]
  }
}

export namespace Cursor {
  export const Data = Symbol.for('@alinea/Cursor.Data')

  export class Find<Row> extends Cursor<Array<Row>> {
    where(...where: Array<Expr<boolean>>): Find<Row> {
      const current = this[Cursor.Data].where
      return new Find(
        this.with({
          where: and(current ? Expr(current) : true, ...where)[Expr.Data]
        })
      )
    }

    search(...searchTerms: Array<string>) {
      return new Find<Row>(this.with({searchTerms}))
    }

    get<S extends Projection>(select: S): Get<Selection.Infer<S>> {
      const query = this.with({first: true})
      if (select) query.select = Selection.create(select, this.id)
      return new Get<Selection.Infer<S>>(query)
    }

    first(): Get<Row> {
      return new Get<Row>(this.with({first: true}))
    }

    maybeFirst(): Get<Row | undefined> {
      return new Get<Row | undefined>(this.with({first: true}))
    }

    select<S extends Projection>(select: S): Find<Selection.Infer<S>> {
      return new Find<Selection.Infer<S>>(
        this.with({select: Selection.create(select, this.id)})
      )
    }

    groupBy(...groupBy: Array<Expr<any>>): Find<Row> {
      return new Find<Row>(this.with({groupBy: groupBy.map(ExprData)}))
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

  export class Partial<Definition> extends Find<Type.Row<Definition>> {
    constructor(
      public type: Type<Definition>,
      public partial: Partial<Type.Row<Definition>>
    ) {
      super({
        id: createId(),
        target: {type},
        where: Partial.condition(type, partial)
      })
    }

    static condition(
      type: Type,
      input: Record<string, any>
    ): ExprData | undefined {
      const conditions = entries(input).map(([key, value]) => {
        const field = Expr(ExprData.Field({type}, key))
        return Expr(
          ExprData.BinOp(field[Expr.Data], BinaryOp.Equals, ExprData(value))
        )
      })
      return and(...conditions)[Expr.Data]
    }
  }

  export class Get<Row> extends Cursor<Row> {
    where(where: ExprData): Get<Row> {
      return new Get<Row>(this.with({where}))
    }

    search(...searchTerms: Array<string>) {
      return new Get<Row>(this.with({searchTerms}))
    }

    select<S extends Projection>(select: S): Get<Selection.Infer<S>> {
      return new Get<Selection.Infer<S>>(
        this.with({select: Selection.create(select, this.id)})
      )
    }
  }
}
