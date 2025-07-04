import type {EntryRow} from './EntryRow.js'
import {Expr} from './Expr.js'
import type {Expand} from './util/Types.js'

export type EntryStatus = 'draft' | 'published' | 'archived'
export const entryStatuses = Array<EntryStatus>(
  'draft',
  'published',
  'archived'
)

export interface EntryData {
  id: string
  parentId: string | null
  type: string
  workspace: string
  root: string
  level: number
  index: string
}

export interface EntryLanguageData extends EntryData {
  path: string
  parentDir: string
  childrenDir: string
  locale: string | null
  seeded: string | null
}

export interface EntryVersionData extends EntryLanguageData {
  status: EntryStatus
  title: string
  filePath: string
  rowHash: string
  fileHash: string
  active: boolean
  main: boolean
  url: string
  data: Record<string, any>
  searchableText: string
}

export interface Entry extends EntryVersionData {}

export const Entry = {
  id: new Expr<string>({type: 'entryField', name: 'id'}),
  status: new Expr<EntryStatus>({type: 'entryField', name: 'status'}),
  title: new Expr<string>({type: 'entryField', name: 'title'}),
  type: new Expr<string>({type: 'entryField', name: 'type'}),
  seeded: new Expr<string | null>({type: 'entryField', name: 'seeded'}),
  workspace: new Expr<string>({type: 'entryField', name: 'workspace'}),
  root: new Expr<string>({type: 'entryField', name: 'root'}),
  level: new Expr<number>({type: 'entryField', name: 'level'}),
  filePath: new Expr<string>({type: 'entryField', name: 'filePath'}),
  parentDir: new Expr<string>({type: 'entryField', name: 'parentDir'}),
  childrenDir: new Expr<string>({type: 'entryField', name: 'childrenDir'}),
  index: new Expr<string>({type: 'entryField', name: 'index'}),
  parentId: new Expr<string | null>({type: 'entryField', name: 'parentId'}),
  locale: new Expr<string | null>({type: 'entryField', name: 'locale'}),
  rowHash: new Expr<string>({type: 'entryField', name: 'rowHash'}),
  active: new Expr<boolean>({type: 'entryField', name: 'active'}),
  main: new Expr<boolean>({type: 'entryField', name: 'main'}),
  path: new Expr<string>({type: 'entryField', name: 'path'}),
  fileHash: new Expr<string>({type: 'entryField', name: 'fileHash'}),
  url: new Expr<string>({type: 'entryField', name: 'url'}),
  data: new Expr<Record<string, any>>({type: 'entryField', name: 'data'}),
  searchableText: new Expr<string>({type: 'entryField', name: 'searchableText'})
}

// We can't export the inferred type because the rado depencency types are
// not included in distribution. At least we'll get a type error here if the
// type is out of date.
type EntryFromRow = Expand<EntryRow>
type Assert<A, B extends A> = never
type Run = Assert<EntryFromRow, Entry> | Assert<Entry, EntryFromRow>
