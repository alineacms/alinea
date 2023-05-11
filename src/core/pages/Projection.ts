import {Type} from 'alinea/core/Type'
import {Cursor} from './Cursor.js'
import {Expr} from './Expr.js'
import {Target} from './Target.js'
import {Tree} from './Tree.js'

interface ProjectionRecord<Source> {
  [key: string]:
    | ((/*this: Fields<Source>,*/ tree: Tree) => PageProjection<Source>)
    | Projection<Source>
}

export type PageProjection<Source> = Cursor<any> | ProjectionRecord<Source>

export type Projection<Source> = Expr<any> | PageProjection<Source>

export namespace Projection {
  export type Infer<T> = [T] extends [Expr<infer V>]
    ? V
    : [T] extends [Target<infer V>]
    ? V
    : [T] extends [Type<infer V>]
    ? Type.Row<V>
    : [T] extends [Cursor<infer V>]
    ? V
    : [T] extends [object]
    ? {
        [K in keyof T]: [T[K]] extends [Target<infer V>]
          ? V
          : [T[K]] extends [Type<infer V>]
          ? Type.Row<V>
          : [T[K]] extends [(...args: any) => infer V]
          ? Infer<V>
          : Infer<T[K]>
      }
    : unknown extends T
    ? never
    : T
}
