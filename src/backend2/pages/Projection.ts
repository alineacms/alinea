import {Cursor} from './Cursor.js'
import {Expr} from './Expr.js'
import {Fields} from './Fields.js'
import {Target} from './Target.js'
import {Tree} from './Tree.js'

export type Projection<Source> =
  | Expr<any>
  | {[Target.IsTarget]: true}
  | Cursor<any>
  | {
      [key: string]:
        | ((this: Fields<Source>, tree: Tree) => Projection<Source>)
        | Projection<Source>
    }

export namespace Projection {
  export type Infer<T> = [T] extends [Expr<infer V>]
    ? V
    : [T] extends [Target<infer V>]
    ? Target.Row<V>
    : [T] extends [Cursor<infer V>]
    ? V
    : [T] extends [object]
    ? {
        [K in keyof T]: [T[K]] extends [Target<infer V>]
          ? Target.Row<V>
          : [T[K]] extends [(...args: any) => infer V]
          ? Infer<V>
          : Infer<T[K]>
      }
    : unknown extends T
    ? never
    : T
}
