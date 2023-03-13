import {Callable} from 'rado/util/Callable'
import {ExprData} from './Expr.js'
import {QueryData} from './Query.js'
import {TargetData} from './Target.js'

export type Traverse =
  | ['children', CursorData]
  | ['parents', CursorData]
  | ['next', CursorData]
  | ['prev', CursorData]

export interface CursorData {
  target?: TargetData
  where?: ExprData
  limit?: [offset?: number, count?: number]
  orderBy?: Array<ExprData>
  select?: QueryData
  first?: boolean
  traverse?: Traverse
}

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
