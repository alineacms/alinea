import {Collection} from './Collection'
import {Cursor} from './Cursor'
import {Expr} from './Expr'

export type QueryOptions = {
  debug?: boolean
}

type IdLess<Row> = Omit<Row, 'id'> & {id?: string}
type Document = {id: string}

export interface Store {
  all<Row>(cursor: Cursor<Row>, options?: QueryOptions): Array<Row>
  first<Row>(cursor: Cursor<Row>, options?: QueryOptions): Row | null
  delete<Row>(cursor: Cursor<Row>, options?: QueryOptions): {changes: number}
  count<Row>(cursor: Cursor<Row>, options?: QueryOptions): number
  insert<Row extends Document>(
    collection: Collection<Row>,
    object: IdLess<Row>,
    options?: QueryOptions
  ): Row & Document
  insertAll<Row extends Document>(
    collection: Collection<Row>,
    objects: IdLess<Row>,
    options?: QueryOptions
  ): Array<Row>
  update<Row>(
    cursor: Cursor<Row>,
    partial: Partial<Row>,
    options?: QueryOptions
  ): {changes: number}
  createIndex<Row extends Document>(
    collection: Collection<Row>,
    name: String,
    on: Array<Expr<any>>
  ): void
  transaction<T>(run: () => T): T
}
