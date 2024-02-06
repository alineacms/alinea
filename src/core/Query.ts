import {Entry} from './Entry.js'
import {Type} from './Type.js'
import {Cursor, SourceType} from './pages/Cursor.js'
import {EV, Expr} from './pages/Expr.js'
import {Projection} from './pages/Projection.js'

/*
// Todo: support multiple types
export function Query<Types extends Array<TypeI>>(
  ...types: Types
): Cursor.Find<Type.Infer<Types[number]>> {
  return undefined!
}*/

export function Query<Definition>(
  type: Type<Definition>
): Cursor.Typed<Definition> {
  return new Cursor.Typed(type)
}

export namespace Query {
  export const and = Expr.and
  export const or = Expr.or
  export const not = <T>(a: EV<T>) => Expr.create(a).not()
  export const is = <T>(a: EV<T>, b: EV<T>) => Expr.create(a).is(b)
  export const isNot = <T>(a: EV<T>, b: EV<T>) => Expr.create(a).isNot(b)
  export const isNull = <T>(a: EV<T>) => Expr.create(a).isNull()
  export const isNotNull = <T>(a: EV<T>) => Expr.create(a).isNotNull()
  export const isIn = <T>(a: EV<T>, b: EV<ReadonlyArray<T>> | Cursor.Find<T>) =>
    Expr.create(a).isIn(b)
  export const isNotIn = <T>(
    a: EV<T>,
    b: EV<ReadonlyArray<T>> | Cursor.Find<T>
  ) => Expr.create(a).isNotIn(b)
  export const isGreater = <T>(a: EV<T>, b: EV<T>) =>
    Expr.create(a).isGreater(b)
  export const isGreaterOrEqual = <T>(a: EV<T>, b: EV<T>) =>
    Expr.create(a).isGreaterOrEqual(b)
  export const isLess = <T>(a: EV<T>, b: EV<T>) => Expr.create(a).isLess(b)
  export const isLessOrEqual = <T>(a: EV<T>, b: EV<T>) =>
    Expr.create(a).isLessOrEqual(b)
  export const add = (
    a: EV<number>,
    b: EV<number>,
    ...rest: Array<EV<number>>
  ) => Expr.create(a).add(b, ...rest)
  export const subtract = (
    a: EV<number>,
    b: EV<number>,
    ...rest: Array<EV<number>>
  ) => Expr.create(a).subtract(b, ...rest)
  export const multiply = (
    a: EV<number>,
    b: EV<number>,
    ...rest: Array<EV<number>>
  ) => Expr.create(a).multiply(b, ...rest)
  export const divide = (
    a: EV<number>,
    b: EV<number>,
    ...rest: Array<EV<number>>
  ) => Expr.create(a).divide(b, ...rest)
  export const remainder = (a: EV<number>, b: EV<number>) =>
    Expr.create(a).remainder(b)
  export const concat = (a: EV<string>, b: EV<string>) =>
    Expr.create(a).concat(b)
  export const like = (a: EV<string>, b: EV<string>) => Expr.create(a).like(b)
  export const at = <T>(a: EV<Array<T>>, index: number) =>
    Expr.create(a).at(index)
  export const includes = <T>(a: EV<Array<T>>, value: EV<T>) =>
    Expr.create(a).includes(value)

  export const url = Entry.url
  export const path = Entry.path
  export const title = Entry.title
  export const id = Entry.entryId
  export const parent = Entry.parent
  export const type = Entry.type
  export const workspace = Entry.workspace
  export const root = Entry.root
  export const locale = Entry.locale
  export const level = Entry.level

  export const entry = {
    id,
    type,
    workspace,
    root,
    locale,
    path,
    title,
    url,
    parent,
    level
  }

  export const where = (...where: Array<EV<boolean>>) => Entry().where(...where)
  export const whereId = (id: string) => Entry().where(Entry.entryId.is(id))
  export const whereUrl = (url: string) => Entry().where(Entry.url.is(url))
  export const wherePath = (path: string) => Entry().where(Entry.path.is(path))
  export const whereLocale = (locale: string) =>
    Entry().where(Entry.locale.is(locale))
  export const whereWorkspace = (workspace: string) =>
    Entry().where(Entry.workspace.is(workspace))
  export const whereRoot = (root: string) => Entry().where(Entry.root.is(root))
  export const whereType = (type: string) => Entry().where(Entry.type.is(type))

  export const select = <S extends Projection>(select: S) =>
    Entry().select(select)
  export const search = (...searchTerms: Array<string>) =>
    Entry().search(...searchTerms)

  export function children<Definition>(
    type?: Type<Definition>,
    depth = 1
  ): Cursor.Find<Type.Infer<Definition>> {
    return new Cursor.Find({
      target: {type},
      source: {type: SourceType.Children, depth}
    })
  }

  export function parents<Definition>(): Cursor.Find<Type.Infer<Definition>> {
    return new Cursor.Find({
      source: {type: SourceType.Parents}
    })
  }

  export function next<Definition>(
    type?: Type<Definition>
  ): Cursor.Get<Type.Infer<Definition>> {
    return new Cursor.Get({
      target: {type},
      source: {type: SourceType.Next}
    })
  }

  export function previous<Definition>(
    type?: Type<Definition>
  ): Cursor.Get<Type.Infer<Definition>> {
    return new Cursor.Get({
      target: {type},
      source: {type: SourceType.Previous}
    })
  }

  export function siblings<Definition>(
    type?: Type<Definition>
  ): Cursor.Find<Type.Infer<Definition>> {
    return new Cursor.Find({
      target: {type},
      source: {type: SourceType.Siblings}
    })
  }

  export function translations<Definition>(
    type?: Type<Definition>
  ): Cursor.Find<Type.Infer<Definition>> {
    return new Cursor.Find({
      target: {type},
      source: {type: SourceType.Translations}
    })
  }
}
