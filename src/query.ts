import {Entry} from '#/core/Entry.js'
import type {
  GraphQuery,
  EdgeChildren,
  EdgeParents,
  EdgeTranslations,
  EdgeSiblings,
  EdgeParent,
  EdgeNext,
  EdgePrevious,
  IncludeGuard,
  SelectionGuard,
  TypeGuard
} from '#/core/Graph.js'

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

export function children<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(
  query: GraphQuery<Selection, Type, Include> & {depth?: number}
): GraphQuery<Selection, Type, Include> & EdgeChildren {
  return {edge: 'children' as const, ...query}
}

export function parents<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(
  query: GraphQuery<Selection, Type, Include> & {depth?: number}
): GraphQuery<Selection, Type, Include> & EdgeParents {
  return {edge: 'parents' as const, ...query}
}

export function translations<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(
  query: GraphQuery<Selection, Type, Include> & {includeSelf?: boolean}
): GraphQuery<Selection, Type, Include> & EdgeTranslations {
  return {edge: 'translations' as const, ...query}
}

export function siblings<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(
  query: GraphQuery<Selection, Type, Include> & {includeSelf?: boolean}
): GraphQuery<Selection, Type, Include> & EdgeSiblings {
  return {edge: 'siblings' as const, ...query}
}

export function parent<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(
  query: GraphQuery<Selection, Type, Include>
): GraphQuery<Selection, Type, Include> & EdgeParent {
  return {edge: 'parent' as const, ...query}
}

export function next<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(
  query: GraphQuery<Selection, Type, Include>
): GraphQuery<Selection, Type, Include> & EdgeNext {
  return {edge: 'next' as const, ...query}
}

export function previous<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(
  query: GraphQuery<Selection, Type, Include>
): GraphQuery<Selection, Type, Include> & EdgePrevious {
  return {edge: 'previous' as const, ...query}
}
