import {createError, Entry, ErrorCode, Schema} from '@alinea/core'
import {Cursor, Expression, Store} from 'helder.store'

export class Pages<T extends Entry> {
  constructor(public schema: Schema<T>, private store: Store) {}

  all<T>(cursor: Cursor<T>): Array<T> {
    return this.store.all(cursor)
  }
  first<T>(cursor: Cursor<T>): T | null {
    return this.store.first(cursor) || null
  }
  sure<T>(cursor: Cursor<T>): T {
    const result = this.first(cursor)
    if (result === null) throw createError(ErrorCode.NotFound)
    return result
  }
  count<T>(cursor: Cursor<T>): number {
    return this.store.count(cursor)
  }
  get root(): Cursor<T> {
    return Entry.where(Entry.$parent.isNull())
  }
  children(entry: string | Expression<string> | Entry, depth = 1): Cursor<T> {
    if (depth > 1) throw 'todo depth > 1'
    const id =
      typeof entry === 'string' ? entry : 'id' in entry ? entry.id : entry
    return Entry.where(Entry.$parent.is(id))
  }
}
