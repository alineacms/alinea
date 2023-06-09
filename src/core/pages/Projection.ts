import {Type} from 'alinea/core/Type'
import {Cursor} from './Cursor.js'
import {Expr} from './Expr.js'
import {Target} from './Target.js'
import {Tree} from './Tree.js'

interface ProjectionRecord {
  [key: string]: ((tree: Tree) => PageProjection) | Projection
}

export type PageProjection = Cursor<any> | ProjectionRecord

export type Projection = Expr<any> | PageProjection

export namespace Projection {
  export type InferOne<T> = [T] extends [Cursor.Find<infer V>] ? V : Infer<T>

  export type Infer<T> = [T] extends [Expr<infer V>]
    ? V
    : [T] extends [Target<infer V>]
    ? V
    : [T] extends [Type<infer V>]
    ? Type.Infer<V>
    : [T] extends [Cursor<infer V>]
    ? V
    : [T] extends [object]
    ? {
        [K in keyof T]: [T[K]] extends [Target<infer V>]
          ? V
          : [T[K]] extends [Type<infer V>]
          ? Type.Infer<V>
          : [T[K]] extends [(...args: any) => infer V]
          ? Infer<V>
          : Infer<T[K]>
      }
    : unknown extends T
    ? never
    : T
}
