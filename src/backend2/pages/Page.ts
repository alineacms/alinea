import {Cursor} from './Cursor.js'
import {Expr, ExprData} from './Expr.js'
import {Projection} from './Projection.js'
import {Query} from './Query.js'
import {Target, TargetI} from './Target.js'

export interface Page {
  id: string
}

export namespace Page {
  export const id = Expr(ExprData.Field({}, 'id'))

  type FindInput = Cursor.Find<any> | TargetI<any>
  export function find<C extends FindInput, P extends Projection>(
    cursor: C
  ): Cursor.Find<Query.Infer<C>>
  export function find<C extends FindInput, P extends Projection>(
    cursor: C,
    projection: P
  ): Cursor.Find<Query.Infer<P>>
  export function find<C extends FindInput, P extends Projection>(
    cursor: C,
    projection?: P
  ): Cursor<any> {
    const query: Cursor.Find<any> = Target.isTarget<any>(cursor)
      ? cursor()
      : cursor
    return projection ? query.select(projection) : query
  }

  type GetInput = Cursor<any> | TargetI<any>
  export function get<C extends GetInput, P extends Projection>(
    cursor: C
  ): Cursor.Get<Query.Infer<C>>
  export function get<C extends GetInput, P extends Projection>(
    cursor: C,
    projection: P
  ): Cursor.Get<Query.Infer<P>>
  export function get<C extends GetInput, P extends Projection>(
    cursor: C,
    projection?: P
  ): Cursor<any> {
    const query: Cursor<any> = Target.isTarget<any>(cursor) ? cursor() : cursor
    const first: Cursor.Get<any> =
      query instanceof Cursor.Find ? query.get() : (query as Cursor.Get<any>)
    return projection ? first.select(projection) : first
  }
}
