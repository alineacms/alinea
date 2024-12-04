import {Entry} from 'alinea/core/Entry'
import {
  GraphQuery,
  IncludeGuard,
  SelectionGuard,
  TypeGuard
} from 'alinea/core/Graph'

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

export {snippet} from 'alinea/core/pages/Snippet'

export function children<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include> & {depth?: number}) {
  return {edge: 'children' as const, ...query}
}

export function parents<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include> & {depth?: number}) {
  return {edge: 'parents' as const, ...query}
}

export function translations<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include> & {includeSelf?: boolean}) {
  return {edge: 'translations' as const, ...query}
}

export function parent<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include>) {
  return {edge: 'parent' as const, ...query}
}

export function next<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include>) {
  return {edge: 'next' as const, ...query}
}

export function previous<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include>) {
  return {edge: 'previous' as const, ...query}
}

export function siblings<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include> & {includeSelf?: boolean}) {
  return {edge: 'siblings' as const, ...query}
}
