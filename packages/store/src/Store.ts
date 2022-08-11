import type {Collection} from './Collection'
import type {Cursor, CursorSingleRow} from './Cursor'
import type {Expr} from './Expr'
import type {Selection, SelectionInput} from './Selection'
import type {Update} from './Update'

export type QueryOptions = {
  debug?: boolean
}

export type IdLess<Row> = Row extends {id: string}
  ? Omit<Row, 'id'> & {id?: string}
  : Row
export type Document = {id: string}

export interface Store {
  all<Row>(cursor: Cursor<Row>, options?: QueryOptions): Array<Row>
  first<Row>(cursor: Cursor<Row>, options?: QueryOptions): Row | null
  count<Row>(cursor: Cursor<Row>, options?: QueryOptions): number
  delete<Row>(cursor: Cursor<Row>, options?: QueryOptions): {changes: number}
  insert<Row>(
    collection: Collection<Row>,
    object: IdLess<Row>,
    options?: QueryOptions
  ): Row
  insertAll<Row>(
    collection: Collection<Row>,
    objects: Array<IdLess<Row>>,
    options?: QueryOptions
  ): Array<Row>
  update<Row>(
    cursor: Cursor<Row>,
    update: Update<Row>,
    options?: QueryOptions
  ): {changes: number}
  createIndex<Row>(
    collection: Collection<Row>,
    name: String,
    on: Array<Expr<any>>
  ): void
  transaction<T>(run: () => T): T
  export(): Uint8Array
}

export namespace Store {
  export type TypeOf<T> = T extends CursorSingleRow<infer K>
    ? K
    : T extends Cursor<infer K>
    ? Array<K>
    : T extends Expr<infer K>
    ? K
    : T extends Selection<infer K>
    ? K
    : T extends Record<string, SelectionInput | Cursor<any>>
    ? {[K in keyof T]: TypeOf<T[K]>}
    : T extends (cursor: any) => infer K
    ? TypeOf<K>
    : T extends Promise<infer K>
    ? K
    : T
}
