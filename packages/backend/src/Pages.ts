import {createId, Entry, Schema, Tree} from '@alinea/core'
import {
  Cursor,
  EV,
  Expr,
  ExprData,
  Fields,
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

  siblings<Sibling = P>(): Multiple<P, Sibling> {
    return new Multiple<P, Sibling>(this.resolver, Tree.siblings(this.id))
  }

  children<Child = P>(depth = 1): Multiple<P, Child> {
    return new Multiple<P, Child>(this.resolver, Tree.children(this.id, depth))
  }

  parents<Parent = P>(): Multiple<P, Parent> {
    return new Multiple<P, Parent>(this.resolver, Tree.parents(this.id))
  }

  parent<Parent = P>(): Single<P, Parent> {
    return new Single<P, Parent>(this.resolver, Tree.parent(this.id))
  }

  nextSibling<Sibling = P>(): Single<P, Sibling> {
    return new Single<P, Sibling>(this.resolver, Tree.nextSibling(this.id))
  }

  prevSibling<Sibling = P>(): Single<P, Sibling> {
    return new Single<P, Sibling>(this.resolver, Tree.prevSibling(this.id))
  }
}

class PageResolver<T> {
  root: Multiple<T, T> = new Multiple<T, T>(this as any, Entry as any)

  constructor(public store: Promise<Store>) {}

  processCallbacks = new Map<string, (value: any) => any>()

  async postProcess(value: any): Promise<any> {
    const tasks = iter<Promise<void> | undefined>(
      value,
      (value, setValue, inner) => {
        const depends = inner
          ? Promise.all(inner.filter(Boolean)).then(() => void 0)
          : undefined
        const isProcessValue =
          value &&
          typeof value === 'object' &&
          '$__process' in value &&
          '$__expr' in value
        if (isProcessValue) {
          const id = value['$__process']
          const expr = value['$__expr']
          const fn = this.processCallbacks.get(id)
          if (fn)
            return Promise.resolve(depends)
              .then(() => {
                return Promise.resolve(fn(expr)).then((result: any) =>
                  setValue(result)
                )
              })
              .finally(() => {
                this.processCallbacks.delete(id)
              })
        }
        return depends
      }
    )
    await Promise.all(tasks.filter(Boolean))
    return value
  }
}

export type Page<P, T> = T extends {id: string} ? T & {tree: PageTree<P>} : T

abstract class Base<P, T> {
  protected result: Promise<T> | undefined

  constructor(
    protected resolver: PageResolver<P>,
    protected cursor: Cursor<any>
  ) {}

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

// Todo: this should be eliminated - Selections need to be expanded to
// allow separate properties for reading (select *) or filtering (where *)
// so we can update the createSelection method below to
function resolveWith<T, X>(
  input: X | ((cursor: Cursor<T>) => X),
  cursor: Cursor<T>
): X {
  return typeof input === 'function' ? (input as Function)(cursor) : input
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
          value: new PageTree<P>(this.resolver, page.id),
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
  /*leftJoin<E = T>(that: Collection<T>, on: Expr<boolean>): Multiple<P, E> {
    return new Multiple<P, E>(this.resolver, this.cursor.leftJoin(that, on))
  }
  innerJoin<E = T>(that: Collection<T>, on: Expr<boolean>): Multiple<P, E> {
    return new Multiple<P, E>(this.resolver, this.cursor.innerJoin(that, on))
  }*/
  take<E = T>(limit: number | undefined): Multiple<P, E> {
    return new Multiple<P, E>(this.resolver, this.cursor.take(limit))
  }
  skip<E = T>(offset: number | undefined): Multiple<P, E> {
    return new Multiple<P, E>(this.resolver, this.cursor.skip(offset))
  }
  where<E = T>(
    where: EV<boolean> | ((collection: Fields<T>) => EV<boolean>)
  ): Multiple<P, E> {
    return new Multiple<P, E>(
      this.resolver,
      this.cursor.where(resolveWith(where as any, Entry))
    )
  }
  whereUrl<E = T>(url: EV<string>): Multiple<P, E> {
    return new Multiple<P, E>(
      this.resolver,
      this.cursor.where(Entry.url.is(url))
    )
  }
  whereId<E = T>(id: EV<string>): Multiple<P, E> {
    return new Multiple<P, E>(this.resolver, this.cursor.where(Entry.id.is(id)))
  }
  whereType<K extends string>(
    this: Pages<{type: string}>,
    type: K
  ): Multiple<P, Extract<T, {type: K}>>
  whereType<E = T>(type: string): Multiple<P, E>
  whereType<E = T>(type: string): Multiple<P, E> {
    return new Multiple<P, E>(
      this.resolver,
      this.cursor.where(Entry.type.is(type as string))
    )
  }
  whereWorkspace<E = T>(workspace: string): Multiple<P, E> {
    return new Multiple<P, E>(
      this.resolver,
      this.cursor.where(Entry.alinea.workspace.is(workspace))
    )
  }
  whereRoot<E = T>(root: string): Multiple<P, E> {
    return new Multiple<P, E>(
      this.resolver,
      this.cursor.where(Entry.alinea.root.is(root))
    )
  }
  select<X extends SelectionInput | ((cursor: Fields<T>) => SelectionInput)>(
    selection: X
  ): Multiple<P, Store.TypeOf<X>> {
    return new Multiple<P, Store.TypeOf<X>>(
      this.resolver,
      this.cursor.select(selection as any)
    )
  }
  having<E = T>(having: Expr<boolean>): Multiple<P, E> {
    return new Multiple<P, E>(this.resolver, this.cursor.having(having))
  }
  orderBy<E = T>(...orderBy: Array<OrderBy>): Multiple<P, E>
  orderBy<E = T>(pick: (cursor: Fields<T>) => Array<OrderBy>): Multiple<P, E>
  orderBy<E = T>(...args: any) {
    const orderBy: Array<OrderBy> =
      args.length === 1 && typeof args[0] === 'function' ? args[0](Entry) : args
    return new Multiple<P, E>(this.resolver, this.cursor.orderBy(...orderBy))
  }
  groupBy<E = T>(...groupBy: Array<Expr<any>>): Multiple<P, E>
  groupBy<E = T>(pick: (cursor: Fields<T>) => Array<Expr<any>>): Multiple<P, E>
  groupBy<E = T>(...args: any) {
    const groupBy: Array<Expr<any>> =
      args.length === 1 && typeof args[0] === 'function' ? args[0](Entry) : args
    return new Multiple<P, E>(this.resolver, this.cursor.groupBy(...groupBy))
  }
  first<E = T>(
    where?: EV<boolean> | ((cursor: Fields<T>) => EV<boolean>)
  ): Single<P, E> {
    if (where) return this.where(resolveWith(where as any, Entry)).first()
    return new Single<P, E>(this.resolver, this.cursor.first())
  }
  sure<E = T>(
    where?: EV<boolean> | ((cursor: Fields<T>) => EV<boolean>)
  ): Base<P, Page<P, E>> {
    return this.first(where) as Base<P, Page<P, E>>
  }
}

class Single<P, T> extends Base<P, Page<P, T> | null> {
  protected async execute() {
    const store = await this.resolver.store
    const row = store.first(this.cursor)
    if (!row) return null
    const page = await this.resolver.postProcess(row)
    if (typeof page === 'object' && 'id' in page) {
      Object.defineProperty(page, 'tree', {
        value: new PageTree<P>(this.resolver, page.id),
        enumerable: false
      })
    }
    return page
  }
  /*leftJoin<E = T>(that: Collection<T>, on: Expr<boolean>): Single<P, E> {
    return new Single<P, E>(this.resolver, this.cursor.leftJoin(that, on))
  }
  innerJoin<E = T>(that: Collection<T>, on: Expr<boolean>): Single<P, E> {
    return new Single<P, E>(this.resolver, this.cursor.innerJoin(that, on))
  }*/
  skip<E = T>(offset: number | undefined): Single<P, E> {
    return new Single<P, E>(this.resolver, this.cursor.skip(offset))
  }
  where<E = T>(
    where: EV<boolean> | ((collection: Fields<T>) => EV<boolean>)
  ): Single<P, E> {
    return new Single<P, E>(this.resolver, this.cursor.where(where as any))
  }
  whereType<K extends string>(
    this: Pages<{type: string}>,
    type: K
  ): Single<P, Extract<T, {type: K}>>
  whereType<E = T>(type: string): Single<P, E>
  whereType<E = T>(type: string): Single<P, E> {
    return new Single<P, E>(
      this.resolver,
      this.cursor.where(Entry.type.is(type as string))
    )
  }
  whereWorkspace<E = T>(workspace: string): Single<P, E> {
    return new Single<P, E>(
      this.resolver,
      this.cursor.where(Entry.alinea.workspace.is(workspace))
    )
  }
  whereRoot<E = T>(root: string): Single<P, E> {
    return new Single<P, E>(
      this.resolver,
      this.cursor.where(Entry.alinea.root.is(root))
    )
  }
  select<
    X extends SelectionInput | ((collection: Fields<T>) => SelectionInput)
  >(selection: X): Single<P, Store.TypeOf<X>> {
    return new Single<P, Store.TypeOf<X>>(
      this.resolver,
      this.cursor.select(selection as any)
    )
  }
  having<E = T>(having: Expr<boolean>): Single<P, E> {
    return new Single<P, E>(this.resolver, this.cursor.having(having))
  }
  /*include<I extends SelectionInput>(selection: I) {
    return new Single<P, Omit<T, keyof Store.TypeOf<I>> & Store.TypeOf<I>>(
      this.resolver,
      this.cursor.include(selection)
    )
  }*/
  orderBy<E = T>(...orderBy: Array<OrderBy>): Single<P, E>
  orderBy<E = T>(pick: (cursor: Fields<T>) => Array<OrderBy>): Single<P, E>
  orderBy<E = T>(...args: any) {
    return new Single<P, E>(this.resolver, this.cursor.orderBy(...args))
  }
  groupBy<E = T>(...groupBy: Array<Expr<any>>): Single<P, E>
  groupBy<E = T>(pick: (cursor: Fields<T>) => Array<Expr<any>>): Single<P, E>
  groupBy<E = T>(...args: any) {
    return new Single<P, E>(this.resolver, this.cursor.groupBy(...args))
  }
  children<E = T>(depth = 1): Multiple<P, E> {
    if (depth > 1) throw 'todo depth > 1'
    return new Multiple<P, E>(
      this.resolver,
      Entry.where(
        Entry.alinea.parent.isIn(
          this.cursor.select<Expr<string | undefined>>(Entry.id)
        )
      )
    )
  }
}

function createSelection(schema: Schema, pages: any): ExprData {
  const cases: Record<string, SelectionInput> = {}
  let isComputed = false
  for (const [key, type] of schema.entries()) {
    const selection = type.selection(type.collection(), pages)
    if (!selection) continue
    cases[key] = selection
    isComputed = true
  }
  if (!isComputed) return Entry.fields.expr
  return Entry.type.case(cases, Entry.fields).expr
}

export class Pages<T> extends Multiple<T, T> {
  constructor(
    schema: Schema<T>,
    createCache: () => Promise<Store>,
    resolver: PageResolver<T> = new PageResolver<T>(createCache()),
    withComputed = true
  ) {
    const from = From.Column(From.Table('Entry', ['data']), 'data')
    const selection: ExprData = withComputed
      ? createSelection(schema, new Pages(schema, createCache, resolver, false))
      : ExprData.Row(from)
    const cursor = new Cursor<T>({
      from,
      selection
    })
    super(resolver, cursor)
  }

  tree(id: EV<string>) {
    return new PageTree<T>(this.resolver, id)
  }

  process<I extends SelectionInput, X>(
    input: I,
    fn: (value: Store.TypeOf<I>) => X | Promise<X>
  ): Expr<X> {
    const id = createId()
    this.resolver.processCallbacks.set(id, fn)
    return new Expr(
      ExprData.Record({
        $__process: Expr.value(id).expr,
        $__expr: Selection.create(input)
      })
    )
  }
}

function iter<T>(
  value: any,
  fn: (value: any, setValue: (value: any) => void, inner: Array<T>) => T
): Array<T> {
  if (!value) return []
  if (Array.isArray(value)) {
    const deps: Array<T> = []
    value.forEach((item, i) => {
      if (!item) return
      const dep = fn(item, v => (value[i] = v), iter(item, fn))
      if (dep) deps.push(dep)
    })
    return deps
  }
  if (typeof value === 'object') {
    const deps: Array<T> = []
    for (const key of Object.keys(value)) {
      if (!value[key]) continue
      const dep = fn(value[key], v => (value[key] = v), iter(value[key], fn))
      if (dep) deps.push(dep)
    }
    return deps
  }
  return []
}
