import type {Cursor, CursorSingleRow} from './Cursor'
import type {EV, Expr} from './Expr'
import type {Selection} from './Selection'

export type Select =
  | Expr<any>
  | Selection<any>
  | {
      [key: string]: Expr<any> | Selection<any> | Cursor<any>
    }

export type TypeOf<T> = T extends Selection<infer K>
  ? K
  : T extends CursorSingleRow<infer K>
  ? K
  : T extends Cursor<infer K>
  ? Array<K>
  : T extends Expr<infer K>
  ? K
  : T extends {[key: string]: Select | Cursor<any>}
  ? {[K in keyof T]: TypeOf<T[K]>}
  : any

export type With<A, B> = Selection<Omit<A, keyof TypeOf<B>> & TypeOf<B>>

export type Update<Row> = Partial<{[K in keyof Row]: EV<Row[K]>}>
