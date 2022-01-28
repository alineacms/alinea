import {accumulate, createError, Entry, ErrorCode, Schema} from '@alinea/core'
import autoBind from 'auto-bind'
import {Cursor, Expression, Store} from 'helder.store'
import {Cache} from './Cache'
import {Drafts} from './Drafts'

export class Pages<T extends Entry> {
  store: Store

  constructor(public schema: Schema<T>, private createCache: () => Store) {
    autoBind(this)
    this.store = createCache()
  }

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
  async preview(drafts: Drafts): Promise<Pages<T>> {
    const updates = await accumulate(drafts.updates())
    if (updates.length === 0) return this
    return new Pages(this.schema, () => {
      const clone = this.createCache()
      Cache.applyUpdates(clone, this.schema, updates)
      return clone
    })
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
  whereUrl(url: string): Cursor<T> {
    return Entry.where(Entry.url.is(url))
  }
  whereId(id: string): Cursor<T> {
    return Entry.where(Entry.id.is(id))
  }
}
