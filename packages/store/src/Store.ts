import type {Collection} from './Collection'
import type {Cursor, CursorSingleRow} from './Cursor'
import type {Expr} from './Expr'
import type {Selection, SelectionInput} from './Selection'
import type {Update} from './Update'

export type QueryOptions = {
  debug?: boolean
}

export type IdLess<Row> = Omit<Row, 'id'> & {id?: string}
export type Document = {id: string}

/*
Someday add a way for user defined functions to be added to the database.
type ExprParameters<T extends (...args: any[]) => any> = T extends (
  ...args: infer P
) => any
  ? {[K in keyof P]: EV<P[K]>}
  : never

type FunctionContructor = <T extends (...params: any[]) => any>(
  name: string,
  run: T
) => (...p: ExprParameters<T>) => EV<ReturnType<T>>
*/

export interface Store {
  all<Row>(cursor: Cursor<Row>, options?: QueryOptions): Array<Row>
  first<Row>(cursor: Cursor<Row>, options?: QueryOptions): Row | null
  delete<Row>(cursor: Cursor<Row>, options?: QueryOptions): {changes: number}
  count<Row>(cursor: Cursor<Row>, options?: QueryOptions): number
  insert<Row extends Document>(
    collection: Collection<Row>,
    object: IdLess<Row>,
    options?: QueryOptions
  ): Row
  insertAll<Row extends Document>(
    collection: Collection<Row>,
    objects: Array<IdLess<Row>>,
    options?: QueryOptions
  ): Array<Row>
  update<Row>(
    cursor: Cursor<Row>,
    update: Update<Row>,
    options?: QueryOptions
  ): {changes: number}
  createIndex<Row extends Document>(
    collection: Collection<Row>,
    name: String,
    on: Array<Expr<any>>
  ): void
  transaction<T>(run: () => T): T
}

export namespace Store {
  export type TypeOf<T> = T extends Selection<infer K>
    ? K
    : T extends CursorSingleRow<infer K>
    ? K
    : T extends Cursor<infer K>
    ? Array<K>
    : T extends Expr<infer K>
    ? K
    : T extends Record<string, SelectionInput | Cursor<any>>
    ? {[K in keyof T]: TypeOf<T[K]>}
    : T
}
