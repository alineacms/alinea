import type {Collection} from './Collection'
import type {Cursor} from './Cursor'
import type {Expr} from './Expr'

export type QueryOptions = {
  debug?: boolean
}

export type IdLess<Row> = Omit<Row, 'id'> & {id?: string}
export type Document = {id: string}

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
    update: Partial<Row>,
    options?: QueryOptions
  ): {changes: number}
  createIndex<Row extends Document>(
    collection: Collection<Row>,
    name: String,
    on: Array<Expr<any>>
  ): void
  transaction<T>(run: () => T): T
}
