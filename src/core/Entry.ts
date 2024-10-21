import {EntryPhase, EntryRow} from './EntryRow.js'
import {Expr} from './Expr.js'
import {Expand} from './util/Types.js'

export interface Entry {
  entryId: string
  phase: EntryPhase
  title: string
  type: string
  seeded: string | null
  workspace: string
  root: string
  level: number
  filePath: string
  parentDir: string
  childrenDir: string
  index: string
  parent: string | null
  i18nId: string
  locale: string | null
  rowHash: string
  active: boolean
  main: boolean
  path: string
  fileHash: string
  url: string
  data: Record<string, any>
  searchableText: string
}
export const Entry = {
  entryId: new Expr<string>({name: 'entryId'}),
  phase: new Expr<EntryPhase>({name: 'phase'}),
  title: new Expr<string>({name: 'title'}),
  type: new Expr<string>({name: 'type'}),
  seeded: new Expr<string | null>({name: 'seeded'}),
  workspace: new Expr<string>({name: 'workspace'}),
  root: new Expr<string>({name: 'root'}),
  level: new Expr<number>({name: 'level'}),
  filePath: new Expr<string>({name: 'filePath'}),
  parentDir: new Expr<string>({name: 'parentDir'}),
  childrenDir: new Expr<string>({name: 'childrenDir'}),
  index: new Expr<string>({name: 'index'}),
  parent: new Expr<string | null>({name: 'parent'}),
  i18nId: new Expr<string>({name: 'i18nId'}),
  locale: new Expr<string | null>({name: 'locale'}),
  rowHash: new Expr<string>({name: 'rowHash'}),
  active: new Expr<boolean>({name: 'active'}),
  main: new Expr<boolean>({name: 'main'}),
  path: new Expr<string>({name: 'path'}),
  fileHash: new Expr<string>({name: 'fileHash'}),
  url: new Expr<string>({name: 'url'}),
  data: new Expr<Record<string, any>>({name: 'data'}),
  searchableText: new Expr<string>({name: 'searchableText'})
}

// We can't export the inferred type because the rado depencency types are
// not included in distribution. At least we'll get a type error here if the
// type is out of date.
type EntryFromRow = Expand<EntryRow>
type Assert<A, B extends A> = never
type Run = Assert<EntryFromRow, Entry> | Assert<Entry, EntryFromRow>
