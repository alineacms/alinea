import {createId, Entry, Tree, Workspace} from '@alinea/core'
import {
  Collection,
  Cursor,
  EV,
  Expr,
  ExprData,
  From,
  OrderBy,
  Selection,
  SelectionInput,
  Store
} from '@alinea/store'

export class PageTree<P> {
  constructor(private resolver: PageResolver<P>, private id: EV<string>) {}

  get root(): Multiple<P, P> {
    return this.resolver.root
  }

  siblings(): Multiple<P, P> {
    return new Multiple(this.resolver, Tree.siblings(this.id))
  }

  children<Child extends P>(depth = 1): Multiple<P, Child> {
    return new Multiple(this.resolver, Tree.children(this.id, depth))
  }

  parents<Parent extends P>(): Multiple<P, Parent> {
    return new Multiple(this.resolver, Tree.parents(this.id))
  }

  parent<Parent extends P>(): Single<P, Parent> {
    return new Single(this.resolver, Tree.parent(this.id))
  }

  nextSibling(): Single<P, P> {
    return new Single(this.resolver, Tree.nextSibling(this.id))
  }

  prevSibling(): Single<P, P> {
    return new Single(this.resolver, Tree.prevSibling(this.id))
  }
}

class PageResolver<T> {
  root: Multiple<T, T>

  constructor(public store: Promise<Store>) {
    this.root = new Multiple(this, Entry)
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

export type Page<P, T> = T extends {id: string} ? T & {tree: PageTree<P>} : T

abstract class Base<P, T> extends Promise<T> {
  protected result: Promise<T> | undefined

  constructor(
    protected resolver: PageResolver<P>,
    protected cursor: Cursor<any>
  ) {
    super(function () {})
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
    const store = await this.resolver.store
    const rows = store.all(this.cursor)
    const res = await Promise.all(
      rows.map(row => this.resolver.postProcess(row))
    )
    return res.map(page => {
      if (page && typeof page === 'object' && 'id' in page) {
        Object.defineProperty(page, 'tree', {
          value: new PageTree(this.resolver, page.id),
          enumerable: false
        })
      }
      return page
    })
  }
  async count(): Promise<number> {
    const store = await this.resolver.store
    return store.count(this.cursor)
  }
  leftJoin<T>(that: Collection<T>, on: Expr<boolean>) {
    return new Multiple<P, T>(this.resolver, this.cursor.leftJoin(that, on))
  }
  innerJoin<T>(that: Collection<T>, on: Expr<boolean>) {
    return new Multiple<P, T>(this.resolver, this.cursor.innerJoin(that, on))
  }
  take(limit: number | undefined) {
    return new Multiple<P, T>(this.resolver, this.cursor.take(limit))
  }
  skip(offset: number | undefined) {
    return new Multiple<P, T>(this.resolver, this.cursor.skip(offset))
  }
  where(where: EV<boolean> | ((collection: Cursor<T>) => EV<boolean>)) {
    return new Multiple<P, T>(this.resolver, this.cursor.where(where as any))
  }
  whereUrl(url: EV<string>) {
    return new Single<T, T>(this.resolver, this.cursor.where(Entry.url.is(url)))
  }
  whereId(id: EV<string>) {
    return new Single<T, T>(this.resolver, this.cursor.where(Entry.id.is(id)))
  }
  whereType<C>(type: Collection<C>) {
    return new Multiple<P, C>(
      this.resolver,
      this.cursor.where(
        this.cursor.get('type').is((type as any).__options.alias)
      )
    )
  }
  select<
    X extends SelectionInput | ((collection: Cursor<T>) => SelectionInput)
  >(selection: X) {
    return new Multiple<P, Store.TypeOf<X>>(
      this.resolver,
      this.cursor.select(selection as any)
    )
  }
  having(having: Expr<boolean>) {
    return new Multiple<P, T>(this.resolver, this.cursor.having(having))
  }
  include<I extends SelectionInput>(selection: I) {
    return new Multiple<P, Omit<T, keyof Store.TypeOf<I>> & Store.TypeOf<I>>(
      this.resolver,
      this.cursor.include(selection)
    )
  }
  orderBy(...orderBy: Array<OrderBy>): Multiple<P, T>
  orderBy(pick: (cursor: Cursor<T>) => Array<OrderBy>): Multiple<P, T>
  orderBy(...args: any) {
    return new Multiple<P, T>(this.resolver, this.cursor.orderBy(...args))
  }
  groupBy(...groupBy: Array<Expr<any>>): Multiple<P, T>
  groupBy(pick: (cursor: Cursor<T>) => Array<Expr<any>>): Multiple<P, T>
  groupBy(...args: any) {
    return new Multiple<P, T>(this.resolver, this.cursor.groupBy(...args))
  }
  first(
    where?: EV<boolean> | ((collection: Cursor<T>) => EV<boolean>)
  ): Single<P, T> {
    if (where) return this.where(where).first()
    return new Single<P, T>(this.resolver, this.cursor.first())
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
    const store = await this.resolver.store
    const row = store.first(this.cursor, {debug: true})
    if (!row) return null
    const page = await this.resolver.postProcess(row)
    if (typeof page === 'object' && 'id' in page) {
      Object.defineProperty(page, 'tree', {
        value: new PageTree(this.resolver, page.id),
        enumerable: false
      })
    }
    return page
  }
  leftJoin<T>(that: Collection<T>, on: Expr<boolean>) {
    return new Single<P, T>(this.resolver, this.cursor.leftJoin(that, on))
  }
  innerJoin<T>(that: Collection<T>, on: Expr<boolean>) {
    return new Single<P, T>(this.resolver, this.cursor.innerJoin(that, on))
  }
  skip(offset: number | undefined) {
    return new Single<P, T>(this.resolver, this.cursor.skip(offset))
  }
  where(where: EV<boolean> | ((collection: Cursor<T>) => EV<boolean>)) {
    return new Single<P, T>(this.resolver, this.cursor.where(where as any))
  }
  whereType<C>(type: Collection<C>) {
    return new Single<P, C>(
      this.resolver,
      this.cursor.where(Entry.type.is((type as any).__options.alias))
    )
  }
  select<
    X extends SelectionInput | ((collection: Cursor<T>) => SelectionInput)
  >(selection: X) {
    return new Single<P, Store.TypeOf<X>>(
      this.resolver,
      this.cursor.select(selection as any)
    )
  }
  having(having: Expr<boolean>) {
    return new Single<P, T>(this.resolver, this.cursor.having(having))
  }
  include<I extends SelectionInput>(selection: I) {
    return new Single<P, Omit<T, keyof Store.TypeOf<I>> & Store.TypeOf<I>>(
      this.resolver,
      this.cursor.include(selection)
    )
  }
  orderBy(...orderBy: Array<OrderBy>): Single<P, T>
  orderBy(pick: (cursor: Cursor<T>) => Array<OrderBy>): Single<P, T>
  orderBy(...args: any) {
    return new Single<P, T>(this.resolver, this.cursor.orderBy(...args))
  }
  groupBy(...groupBy: Array<Expr<any>>): Single<P, T>
  groupBy(pick: (cursor: Cursor<T>) => Array<Expr<any>>): Single<P, T>
  groupBy(...args: any) {
    return new Single<P, T>(this.resolver, this.cursor.groupBy(...args))
  }
  children<C = T>(depth = 1) {
    if (depth > 1) throw 'todo depth > 1'
    return new Multiple<P, C>(
      this.resolver,
      Entry.where(
        Entry.parent.isIn(
          this.cursor.select<Expr<string | undefined>>(Entry.id)
        )
      )
    )
  }
}

function createSelection<T>(
  workspace: Workspace<T>,
  pages: PagesImpl<T>
): ExprData {
  const cases: Record<string, SelectionInput> = {}
  for (const [key, type] of workspace.schema.entries()) {
    cases[key] = type.selection(pages as Pages<T>)
  }
  return Entry.type.case(cases).expr
}

class PagesImpl<T> extends Multiple<T, T> {
  constructor(
    workspace: Workspace<T>,
    createCache: () => Promise<Store>,
    withComputed = true
  ) {
    const from = From.Column(From.Table('Entry', ['data']), 'data')
    const cursor = new Cursor<T>({
      from,
      selection: withComputed
        ? createSelection(
            workspace,
            new PagesImpl(workspace, createCache, false)
          )
        : ExprData.Row(from)
    })
    super(new PageResolver(createCache()), cursor)
    for (const [key, type] of Object.entries(workspace.schema.types)) {
      ;(this as any)[key] = this.whereType(type.collection())
    }
  }

  tree(id: EV<string>) {
    return new PageTree(this.resolver, id)
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
  new <T>(workspace: Workspace<T>, createCache: () => Promise<Store>): Pages<T>
}
export type Pages<T> = PagesImpl<T> & {
  [K in T extends {type: string} ? T['type'] : string]: Multiple<
    T,
    Extract<T, {type: K}>
  >
}
export const Pages = PagesImpl as any as PagesConstructor
