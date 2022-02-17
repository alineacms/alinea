import {
  accumulate,
  createError,
  Entry,
  ErrorCode,
  Schema,
  Workspace
} from '@alinea/core'
import {Cursor, Expr, Store} from '@alinea/store'
import autoBind from 'auto-bind'
import {Cache} from './Cache'
import {Drafts} from './Drafts'

export class Pages<T extends Entry> {
  schema: Schema<T>
  store: Promise<Store>

  constructor(
    private workspace: Workspace<T>,
    private createCache: () => Promise<Store>
  ) {
    autoBind(this)
    this.schema = workspace.schema
    this.store = createCache()
  }

  async all<T>(cursor: Cursor<T>): Promise<Array<T>> {
    const store = await this.store
    return store.all(cursor)
  }
  async first<T>(cursor: Cursor<T>): Promise<T | null> {
    const store = await this.store
    return store.first(cursor) || null
  }
  async sure<T>(cursor: Cursor<T>): Promise<T> {
    const result = await this.first(cursor)
    if (result === null) throw createError(ErrorCode.NotFound)
    return result
  }
  async count<T>(cursor: Cursor<T>): Promise<number> {
    const store = await this.store
    return store.count(cursor)
  }
  preview(drafts: Drafts): Pages<T> {
    return new Pages(this.workspace, async () => {
      const updates = await accumulate(drafts.updates())
      if (updates.length === 0) return this.store
      const clone = await this.createCache()
      Cache.applyUpdates(clone, this.schema, updates)
      return clone
    })
  }

  get root(): Cursor<T> {
    return Entry.where(Entry.parent.isNull())
  }
  children(entry: string | Expr<string> | Entry, depth = 1): Cursor<T> {
    if (depth > 1) throw 'todo depth > 1'
    const id =
      typeof entry === 'string' ? entry : 'id' in entry ? entry.id : entry
    return Entry.where(Entry.parent.is(id))
  }
  byUrl(url: string): Cursor<T> {
    return Entry.where(Entry.url.is(url))
  }
  byId(id: string): Cursor<T> {
    return Entry.where(Entry.id.is(id))
  }
}
