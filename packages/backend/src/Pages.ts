import {
  Config,
  createError,
  Entry,
  ErrorCode,
  Schema,
  Workspace
} from '@alinea/core'
import {Cursor, Expr, Store} from '@alinea/store'
import autoBind from 'auto-bind'
import {Drafts} from './Drafts'
import {previewStore} from './PreviewStore'

export class Pages<T extends Entry> {
  schema: Schema<T>
  store: Promise<Store>

  constructor(
    private config: Config,
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
  preview(drafts: Drafts, id?: string): Pages<T> {
    return new Pages(this.config, this.workspace, async () => {
      const preview = previewStore(this.createCache, this.config, drafts)
      if (id) await preview.fetchUpdate(id)
      return preview.getStore()
    })
  }

  get root(): Cursor<T> {
    return Entry.where(Entry.parent.isNull()) as any
  }
  children(entry: string | Expr<string> | Entry, depth = 1): Cursor<T> {
    if (depth > 1) throw 'todo depth > 1'
    const id =
      typeof entry === 'string' ? entry : 'id' in entry ? entry.id : entry
    return Entry.where(Entry.parent.is(id)) as any
  }
  byUrl(url: string): Cursor<T> {
    return Entry.where(Entry.url.is(url)) as any
  }
  byId(id: string): Cursor<T> {
    return Entry.where(Entry.id.is(id)) as any
  }
}
