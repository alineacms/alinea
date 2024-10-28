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
  const {depth, ...rest} = query
  return {children: {depth}, ...rest}
}

export function parents<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include> & {depth?: number}) {
  const {depth, ...rest} = query
  return {parents: {depth}, ...rest}
}

export function translations<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include> & {includeSelf?: boolean}) {
  const {includeSelf, ...rest} = query
  return {translations: {includeSelf}, ...rest}
}

export function parent<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include>) {
  return {parent: {}, ...query}
}

export function next<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include>) {
  return {next: {}, ...query}
}

export function previous<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include>) {
  return {previous: {}, ...query}
}

export function siblings<
  Selection extends SelectionGuard = undefined,
  Type extends TypeGuard = undefined,
  Include extends IncludeGuard = undefined
>(query: GraphQuery<Selection, Type, Include> & {includeSelf?: boolean}) {
  const {includeSelf, ...rest} = query
  return {siblings: {includeSelf}, ...rest}
}
