import {array, boolean, enums, number, object} from 'cito'
import {Callable} from 'rado/util/Callable'
import {ExprData} from './Expr.js'
import {Page} from './Page.js'
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
export class Cursor<T> extends Callable {
  declare [brand]: T
  constructor(data: CursorData, fn: (input: any) => Cursor<T>) {
    super(fn)
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
}

export interface Select<Row> extends Callable {
  <S>(select: S): Select<Query.Infer<S>>
}

export class Select<Row> extends Cursor<Array<Row>> {
  constructor(data: CursorData) {
    super(data, function select(input: any) {
      return new Select({...data, select: QueryData(input)})
    })
  }

  with<S>(select: S): Select<Query.Combine<Row, S>> {
    return new Select({...this[Cursor.Data], select: QueryData(select)})
  }

  only<S>(select: S): Select<Query.Infer<S>> {
    return new Select({...this[Cursor.Data], select: QueryData(select)})
  }

  first(): SelectFirst<Row> {
    return new SelectFirst({...this[Cursor.Data], first: true})
  }
}

export interface SelectFirst<Row> extends Callable {
  <S>(select: S): SelectFirst<Query.Infer<S>>
}

export class SelectFirst<Row> extends Cursor<Row> {
  constructor(data: CursorData) {
    super(data, function selectFirst(input: any) {
      return new SelectFirst({
        ...data,
        select: QueryData(input),
        first: true
      })
    })
  }

  with<S>(select: S): SelectFirst<Row & Query.Infer<S>> {
    return new SelectFirst({
      ...this[Cursor.Data],
      select: QueryData(select)
    })
  }

  only<S>(select: S): SelectFirst<Query.Infer<S>> {
    return new SelectFirst({
      ...this[Cursor.Data],
      select: QueryData(select)
    })
  }

  prev(): Select<Page> {
    return new Select({traverse: {type: 'Previous', cursor: this[Cursor.Data]}})
  }

  next(): Select<Page> {
    return new Select({traverse: {type: 'Next', cursor: this[Cursor.Data]}})
  }

  children<T = Page>(define?: Select<T>): Select<T> {
    return new Select({traverse: {type: 'Children', cursor: this[Cursor.Data]}})
  }

  parents<T = Page>(define?: Select<T>): Select<T> {
    return new Select({traverse: {type: 'Parents', cursor: this[Cursor.Data]}})
  }
}
