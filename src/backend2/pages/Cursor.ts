import {array, boolean, enums, number, object} from 'cito'
import {ExprData} from './Expr.js'
import {Page} from './Page.js'
import {Projection} from './Projection.js'
import {Query, QueryData} from './Query.js'
import {TargetData} from './Target.js'

export type CursorData = typeof CursorData.infer
export const CursorData = object(
  class {
    target? = TargetData.optional
    where? = ExprData.adt.optional
    skip? = number.optional
    take? = number.optional
    orderBy? = array(ExprData.adt).optional
    select? = QueryData.adt.optional
    first? = boolean.optional
    traverse? = Traverse.optional
  }
)

export enum TraverseType {
  Children = 'children',
  Parents = 'parents',
  Next = 'next',
  Previous = 'previous'
}

export const Traverse = object({
  type: enums(TraverseType),
  cursor: CursorData
})

export interface Cursor<T> {
  [Cursor.Data]: CursorData
}

declare const brand: unique symbol
export class Cursor<T> {
  declare [brand]: T
  constructor(data: CursorData) {
    this[Cursor.Data] = data
  }

  static isCursor<T>(input: any): input is Cursor<T> {
    return input instanceof Cursor
  }

  toJSON() {
    return this[Cursor.Data]
  }
}

export namespace Cursor {
  export const Data = Symbol('Cursor.Data')

  export class Find<Row> extends Cursor<Array<Row>> {
    constructor(data: CursorData) {
      super(data)
    }

    where(where: ExprData): Find<Row> {
      return new Find({...this[Cursor.Data], where})
    }

    get<S extends Projection<Row>>(
      select?: S
    ): Get<[S] extends [undefined] ? Row : Query.Infer<S>> {
      const data = {...this[Cursor.Data], first: true}
      if (select) data.select = QueryData(select)
      return new Get(data)
    }

    select<S extends Projection<Row>>(select: S): Find<Query.Infer<S>> {
      return new Find({...this[Cursor.Data], select: QueryData(select)})
    }
  }

  export class Get<Row> extends Cursor<Row> {
    constructor(data: CursorData) {
      super(data)
    }

    select<S extends Projection<Row>>(select: S): Get<Query.Infer<S>> {
      return new Get({...this[Cursor.Data], select: QueryData(select)})
    }

    prev(): Find<Page> {
      return new Find({
        traverse: {type: 'Previous', cursor: this[Cursor.Data]}
      })
    }

    next(): Find<Page> {
      return new Find({traverse: {type: 'Next', cursor: this[Cursor.Data]}})
    }

    children<T = Page>(define?: Find<T>): Find<T> {
      return new Find({
        traverse: {type: 'Children', cursor: this[Cursor.Data]}
      })
    }

    parents<T = Page>(define?: Find<T>): Find<T> {
      return new Find({
        traverse: {type: 'Parents', cursor: this[Cursor.Data]}
      })
    }
  }
}
