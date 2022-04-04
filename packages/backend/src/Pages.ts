import {Config, Entry, Schema, TypesOf, Workspace} from '@alinea/core'
import {
  Collection,
  Cursor,
  EV,
  Expr,
  OrderBy,
  SelectionInput,
  Store
} from '@alinea/store'
import {Drafts} from './Drafts'
import {previewStore} from './PreviewStore'

export class Tree<P> {
  constructor(private pages: Pages<P>, private id: string) {}

  get root(): Pages<P> {
    return this.pages
  }

  get siblings(): Multiple<P, P> {
    const Self = Entry.as('Self')
    return this.pages
      .find(
        Entry.parent.is(
          Self.where(Self.id.is(this.id)).select(Self.parent).first()
        )
      )
      .where(Entry.id.isNot(this.id))
  }

  find(
    where: EV<boolean> | ((collection: Cursor<P>) => EV<boolean>)
  ): Multiple<P, P> {
    return new Multiple(this.pages, this.pages.collection.where(where))
  }

  children<C extends P>(depth = 1): Multiple<P, C> {
    if (depth > 1) throw 'todo depth > 1'
    return new Multiple(
      this.pages,
      this.pages.collection
        .where(Entry.parent.is(this.id))
        .orderBy(Entry.index.asc())
    )
  }

  nextSibling(): Single<P, P> {
    const Self = Entry.as('Self')
    const self = Self.where(Self.id.is(this.id))
    return this.pages
      .find(Entry.parent.is(self.select(Self.parent).first()))
      .orderBy(Entry.index.asc())
      .where(Entry.index.greater(self.select(Self.index).first()))
      .first()
  }

  prevSibling(): Single<P, P> {
    const Self = Entry.as('Self')
    const self = Self.where(Self.id.is(this.id))
    return this.pages
      .find(Entry.parent.is(self.select(Self.parent).first()))
      .orderBy(Entry.index.desc())
      .where(Entry.index.less(self.select(Self.index).first()))
      .first()
  }
}

export type Page<P, T> = T extends {id: string} ? T & {tree: Tree<P>} : T

abstract class Base<P, T> extends Promise<T> {
  protected result: Promise<T> | undefined

  constructor(protected pages: Pages<P>, protected cursor: Cursor<any>) {
    super(_ => _(undefined!))
  }

  protected abstract execute(): Promise<T>

  then: Promise<T>['then'] = (...args: Array<any>) => {
    this.result = this.result || this.execute()
    return this.result.then(...args)
  }

  catch: Promise<T>['catch'] = (...args: Array<any>) => {
    this.result = this.result || this.execute()
    return this.result.catch(...args)
  }
}

class Multiple<P, T> extends Base<P, Array<Page<P, T>>> {
  protected async execute() {
    const store = await this.pages.store
    return store.all(this.cursor).map(page => {
      if (page && typeof page === 'object' && 'id' in page) {
        Object.defineProperty(page, 'tree', {
          value: new Tree(this.pages, page.id),
          enumerable: false
        })
      }
      return page
    })
  }
  async count(): Promise<number> {
    const store = await this.pages.store
    return store.count(this.cursor)
  }
  leftJoin<T>(that: Collection<T>, on: Expr<boolean>) {
    return new Multiple<P, T>(this.pages, this.cursor.leftJoin(that, on))
  }
  innerJoin<T>(that: Collection<T>, on: Expr<boolean>) {
    return new Multiple<P, T>(this.pages, this.cursor.innerJoin(that, on))
  }
  take(limit: number | undefined) {
    return new Multiple<P, T>(this.pages, this.cursor.take(limit))
  }
  skip(offset: number | undefined) {
    return new Multiple<P, T>(this.pages, this.cursor.skip(offset))
  }
  where(where: EV<boolean> | ((collection: Cursor<T>) => EV<boolean>)) {
    return new Multiple<P, T>(this.pages, this.cursor.where(where as any))
  }
  select<
    X extends SelectionInput | ((collection: Cursor<T>) => SelectionInput)
  >(selection: X) {
    return new Multiple<P, Store.TypeOf<X>>(
      this.pages,
      this.cursor.select(selection as any)
    )
  }
  having(having: Expr<boolean>) {
    return new Multiple<P, T>(this.pages, this.cursor.having(having))
  }
  include<I extends SelectionInput>(selection: I) {
    return new Multiple<P, Omit<T, keyof Store.TypeOf<I>> & Store.TypeOf<I>>(
      this.pages,
      this.cursor.include(selection)
    )
  }
  orderBy(...orderBy: Array<OrderBy>) {
    return new Multiple<P, T>(this.pages, this.cursor.orderBy(...orderBy))
  }
  groupBy(...groupBy: Array<Expr<any>>) {
    return new Multiple<P, T>(this.pages, this.cursor.groupBy(...groupBy))
  }
  first() {
    return new Single<P, T>(this.pages, this.cursor.first() as any)
  }
}

class Single<P, T> extends Base<P, Page<P, T> | null> {
  protected async execute() {
    const store = await this.pages.store
    const page = store.first(this.cursor)
    if (!page) return null
    if (typeof page === 'object' && 'id' in page) {
      Object.defineProperty(page, 'tree', {
        value: new Tree(this.pages, page.id),
        enumerable: false
      })
    }
    return page
  }
  leftJoin<T>(that: Collection<T>, on: Expr<boolean>) {
    return new Single<P, T>(this.pages, this.cursor.leftJoin(that, on))
  }
  innerJoin<T>(that: Collection<T>, on: Expr<boolean>) {
    return new Single<P, T>(this.pages, this.cursor.innerJoin(that, on))
  }
  skip(offset: number | undefined) {
    return new Single<P, T>(this.pages, this.cursor.skip(offset))
  }
  where(where: EV<boolean> | ((collection: Cursor<T>) => EV<boolean>)) {
    return new Single<P, T>(this.pages, this.cursor.where(where as any))
  }
  select<
    X extends SelectionInput | ((collection: Cursor<T>) => SelectionInput)
  >(selection: X) {
    return new Single<P, Store.TypeOf<X>>(
      this.pages,
      this.cursor.select(selection as any)
    )
  }
  having(having: Expr<boolean>) {
    return new Single<P, T>(this.pages, this.cursor.having(having))
  }
  include<I extends SelectionInput>(selection: I) {
    return new Single<P, Omit<T, keyof Store.TypeOf<I>> & Store.TypeOf<I>>(
      this.pages,
      this.cursor.include(selection)
    )
  }
  orderBy(...orderBy: Array<OrderBy>) {
    return new Single<P, T>(this.pages, this.cursor.orderBy(...orderBy))
  }
  groupBy(...groupBy: Array<Expr<any>>) {
    return new Single<P, T>(this.pages, this.cursor.groupBy(...groupBy))
  }
  children<C = T>(depth = 1) {
    if (depth > 1) throw 'todo depth > 1'
    return new Multiple<P, C>(
      this.pages,
      Entry.where(
        Entry.parent.isIn(
          this.cursor.select<Expr<string | undefined>>(Entry.id)
        )
      ) as any
    )
  }
}

class PagesImpl<T> {
  schema: Schema<T>
  collection = new Collection<T>('Entry')
  store: Promise<Store>

  constructor(
    private config: Config,
    private workspace: Workspace<T>,
    private createCache: () => Promise<Store>
  ) {
    this.schema = workspace.schema
    this.store = createCache()
    const self = this
    return new Proxy(this, {
      get(target: any, key: string) {
        if (key in target) return target[key]
        const type = self.schema.type(key as TypesOf<T>)
        if (type) {
          const [workspaceKey] =
            Object.entries(self.config.workspaces).find(
              ([name, workspace]) => workspace === self.workspace
            ) || []
          if (workspaceKey)
            return self.ofType(self.schema.collection(workspaceKey, key as any))
        }
        return undefined
      }
    })
  }

  ofType<C>(type: Collection<C>) {
    return new Multiple<T, C>(
      this as Pages<T>,
      type.cursor.where
        ? this.collection.where(Entry.type.is(new Expr(type.cursor.where)))
        : this.collection
    )
  }

  all(): Multiple<T, T> {
    return new Multiple(this as Pages<T>, this.collection) as any
  }

  find(
    where: EV<boolean> | ((collection: Cursor<T>) => EV<boolean>)
  ): Multiple<T, T> {
    return new Multiple(this as Pages<T>, this.collection.where(where)) as any
  }

  fetch(
    where: EV<boolean> | ((collection: Cursor<T>) => EV<boolean>)
  ): Single<T, T> {
    return new Single<T, T>(
      this as Pages<T>,
      this.collection.where(where)
    ) as any
  }

  preview(drafts: Drafts, id?: string): Pages<T> {
    return new Pages(this.config, this.workspace, async () => {
      const preview = previewStore(this.createCache, this.config, drafts)
      if (id) await preview.fetchUpdate(id)
      return preview.getStore()
    })
  }

  get root() {
    return this.find(Entry.parent.isNull())
  }
}

export interface PagesConstructor {
  new <T>(
    config: Config,
    workspace: Workspace<T>,
    createCache: () => Promise<Store>
  ): Pages<T>
}
export type Pages<T> = PagesImpl<T> & {
  [K in T extends {type: string} ? T['type'] : string]: Multiple<
    T,
    Extract<T, {type: K}>
  >
}
export const Pages = PagesImpl as PagesConstructor
