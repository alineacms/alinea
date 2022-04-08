import {
  Config,
  createId,
  Entry,
  Schema,
  Tree,
  TypesOf,
  Workspace
} from '@alineacms/core'
import {
  Collection,
  Cursor,
  EV,
  Expr,
  ExprData,
  OrderBy,
  Selection,
  SelectionInput,
  Store
} from '@alineacms/store'

export class PageTree<P> {
  constructor(private pages: Pages<P>, private id: EV<string>) {}

  get root(): Pages<P> {
    return this.pages
  }

  siblings(): Multiple<P, P> {
    return new Multiple(this.pages, Tree.siblings(this.id))
  }

  children<Child extends P>(depth = 1): Multiple<P, Child> {
    return new Multiple(this.pages, Tree.children(this.id, depth))
  }

  parents<Parent extends P>(): Multiple<P, Parent> {
    return new Multiple(this.pages, Tree.parents(this.id))
  }

  nextSibling(): Single<P, P> {
    return new Single(this.pages, Tree.nextSibling(this.id))
  }

  prevSibling(): Single<P, P> {
    return new Single(this.pages, Tree.prevSibling(this.id))
  }
}

export type Page<P, T> = T extends {id: string} ? T & {tree: PageTree<P>} : T

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
    const rows = store.all(this.cursor)
    const res = await Promise.all(rows.map(row => this.pages.postProcess(row)))
    return res.map(page => {
      if (page && typeof page === 'object' && 'id' in page) {
        Object.defineProperty(page, 'tree', {
          value: new PageTree(this.pages, page.id),
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
  whereType<C>(type: Collection<C>) {
    return new Multiple<P, C>(
      this.pages,
      this.cursor.where(Entry.type.is((type as any).__options.alias))
    )
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
  /*on<
  K extends TypesOf<T>,
  X extends SelectionInput | ((collection: Cursor<Extract<T, {type: K}>>) => SelectionInput)
  >(type: K, select: X) {
    return new Multiple
  }*/
}

class Single<P, T> extends Base<P, Page<P, T> | null> {
  protected async execute() {
    const store = await this.pages.store
    const row = store.first(this.cursor)
    if (!row) return null
    const page = await this.pages.postProcess(row)
    if (typeof page === 'object' && 'id' in page) {
      Object.defineProperty(page, 'tree', {
        value: new PageTree(this.pages, page.id),
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
      )
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
            return self.whereType(
              self.schema.collection(workspaceKey, key as any)
            )
        }
        return undefined
      }
    })
  }

  whereUrl(url: EV<string>) {
    return new Single<T, T>(this as Pages<T>, Entry.where(Entry.url.is(url)))
  }

  whereId(id: EV<string>) {
    return new Single<T, T>(this as Pages<T>, Entry.where(Entry.id.is(id)))
  }

  whereType<C>(type: Collection<C>) {
    return new Multiple<T, C>(
      this as Pages<T>,
      type.cursor.where
        ? this.collection.where(Entry.type.is((type as any).__options.alias))
        : this.collection
    )
  }

  all(): Multiple<T, T> {
    return new Multiple(this as Pages<T>, this.collection)
  }

  findMany(
    where: Expr<boolean> | ((collection: Cursor<T>) => Expr<boolean>)
  ): Multiple<T, T> {
    return new Multiple(this as Pages<T>, this.collection.where(where))
  }

  findFirst(
    where: Expr<boolean> | ((collection: Cursor<T>) => Expr<boolean>)
  ): Single<T, T> {
    return new Single<T, T>(this as Pages<T>, this.collection.where(where))
  }

  get root() {
    return this.findMany(Entry.parent.isNull())
  }

  processCallbacks = new Map<string, (value: any) => any>()
  process<I extends SelectionInput, X>(
    input: I,
    fn: (value: Store.TypeOf<I>) => X | Promise<X>
  ): Expr<X> {
    const id = createId()
    this.processCallbacks.set(id, fn)
    return new Expr(
      ExprData.Record({
        $__process: Expr.value(id).expr,
        $__expr: Selection.create(input)
      })
    )
  }

  processTypes<
    I extends SelectionInput,
    Transform extends Record<string, (value: any) => any>
  >(
    input: I,
    transform: Transform
  ): Expr<ProcessTypes<Store.TypeOf<I>, Transform>> {
    return this.process(input, async function post(value: any): Promise<any> {
      const tasks: Array<() => Promise<void>> = []
      iter(value, (value, setValue) => {
        const needsTransforming =
          value &&
          typeof value === 'object' &&
          'type' in value &&
          transform[value.type]
        if (needsTransforming) {
          tasks.push(async () => {
            const result = await transform[value.type](value)
            setValue(result)
          })
          return false
        }
        return true
      })
      await Promise.all(tasks.map(fn => fn()))
      // we can keep processing results, but... it's too easy to return the same types?
      // if (tasks.length > 0) return await post(value)
      return value
    }) as any
  }

  async postProcess(value: any): Promise<any> {
    const tasks: Array<() => Promise<void>> = []
    iter(value, (value, setValue) => {
      const isProcessValue =
        value &&
        typeof value === 'object' &&
        '$__process' in value &&
        '$__expr' in value
      if (isProcessValue) {
        const id = value['$__process']
        const expr = value['$__expr']
        const fn = this.processCallbacks.get(id)
        if (!fn) return true
        tasks.push(async () => {
          try {
            const result = await fn(expr)
            setValue(result)
          } finally {
            this.processCallbacks.delete(id)
          }
        })
        return false
      }
      return true
    })
    await Promise.all(tasks.map(fn => fn()))
    return value
  }
}

type UnPromisify<T> = T extends Promise<infer U> ? U : T

type ProcessTypes<
  T,
  F extends Record<string, (...args: any) => any>
> = T extends Array<infer V>
  ? Array<ProcessTypes<V, F>>
  : T extends {type: keyof F}
  ? UnPromisify<ReturnType<F[T['type']]>>
  : T extends object
  ? {[K in keyof T]: ProcessTypes<T[K], F>}
  : T

function iter(
  value: any,
  fn: (value: any, setValue: (value: any) => void) => boolean
): void {
  if (!value) return
  if (Array.isArray(value))
    return value.forEach((item, i) => {
      if (item && fn(item, v => (value[i] = v))) iter(value[i], fn)
    })
  if (typeof value === 'object') {
    for (const key of Object.keys(value))
      if (value[key] && fn(value[key], v => (value[key] = v)))
        iter(value[key], fn)
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
