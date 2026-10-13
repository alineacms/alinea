import {Entry} from '#/core/Entry.js'
import type {Expr} from '#/core/Expr.js'
import type {
  GraphQuery,
  IncludeGuard,
  PickModifiers,
  QueryModifiers,
  SelectionGuard,
  TypeGuard
} from '#/core/Graph.js'
import type {HasField} from '#/core/Internal.js'

export const id = Entry.id
export const title = Entry.title
export const type = Entry.type
export const index = Entry.index
export const workspace = Entry.workspace
export const root = Entry.root
export const status = Entry.status
export const parentId = Entry.parentId
export const locale = Entry.locale
export const path = Entry.path
export const url = Entry.url
export const aliases = Entry.aliases
export const createdAt = Entry.createdAt
export const updatedAt = Entry.updatedAt

export {snippet} from '#/core/pages/Snippet.js'

/** A relation query, see PickModifiers */
type RelationQuery<Edge extends string, Selection, Type, Include, Modifiers> = {
  edge: Edge
} & GraphQuery<NoInfer<Selection>, NoInfer<Type>, NoInfer<Include>> &
  PickModifiers<NoInfer<Modifiers>>

export function children<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined,
  Modifiers extends QueryModifiers = {}
>(
  query: GraphQuery<Selection, Type, Include> & Modifiers & {depth?: number}
): RelationQuery<'children', Selection, Type, Include, Modifiers> & {
  depth?: number
} {
  return {edge: 'children' as const, ...query}
}

export function parents<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined,
  Modifiers extends QueryModifiers = {}
>(
  query: GraphQuery<Selection, Type, Include> & Modifiers & {depth?: number}
): RelationQuery<'parents', Selection, Type, Include, Modifiers> & {
  depth?: number
} {
  return {edge: 'parents' as const, ...query}
}

export function translations<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined,
  Modifiers extends QueryModifiers = {}
>(
  query: GraphQuery<Selection, Type, Include> &
    Modifiers & {includeSelf?: boolean}
): RelationQuery<'translations', Selection, Type, Include, Modifiers> & {
  includeSelf?: boolean
} {
  return {edge: 'translations' as const, ...query}
}

export function siblings<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined,
  Modifiers extends QueryModifiers = {}
>(
  query: GraphQuery<Selection, Type, Include> &
    Modifiers & {includeSelf?: boolean}
): RelationQuery<'siblings', Selection, Type, Include, Modifiers> & {
  includeSelf?: boolean
} {
  return {edge: 'siblings' as const, ...query}
}

export function parent<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined,
  Modifiers extends QueryModifiers = {}
>(
  query: GraphQuery<Selection, Type, Include> & Modifiers
): RelationQuery<'parent', Selection, Type, Include, Modifiers> {
  return {edge: 'parent' as const, ...query}
}

export function next<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined,
  Modifiers extends QueryModifiers = {}
>(
  query: GraphQuery<Selection, Type, Include> & Modifiers
): RelationQuery<'next', Selection, Type, Include, Modifiers> {
  return {edge: 'next' as const, ...query}
}

export function previous<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined,
  Modifiers extends QueryModifiers = {}
>(
  query: GraphQuery<Selection, Type, Include> & Modifiers
): RelationQuery<'previous', Selection, Type, Include, Modifiers> {
  return {edge: 'previous' as const, ...query}
}

/**
 * The entries that link to the entry, eg. the products of a brand:
 * `Query.referencedBy({type: Product})`. Set `field` to only follow one
 * link field, eg. `{type: Product, field: Product.brand}`.
 */
export function referencedBy<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined,
  Modifiers extends QueryModifiers = {}
>(
  query: GraphQuery<Selection, Type, Include> &
    Modifiers & {field?: HasField & Expr}
): RelationQuery<'referencedBy', Selection, Type, Include, Modifiers> & {
  field?: HasField & Expr
} {
  return {edge: 'referencedBy' as const, ...query}
}
