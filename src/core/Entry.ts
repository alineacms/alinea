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
  entryId: new Expr<string>(),
  phase: new Expr<EntryPhase>(),
  title: new Expr<string>(),
  type: new Expr<string>(),
  seeded: new Expr<string | null>(),
  workspace: new Expr<string>(),
  root: new Expr<string>(),
  level: new Expr<number>(),
  filePath: new Expr<string>(),
  parentDir: new Expr<string>(),
  childrenDir: new Expr<string>(),
  index: new Expr<string>(),
  parent: new Expr<string | null>(),
  i18nId: new Expr<string>(),
  locale: new Expr<string | null>(),
  rowHash: new Expr<string>(),
  active: new Expr<boolean>(),
  main: new Expr<boolean>(),
  path: new Expr<string>(),
  fileHash: new Expr<string>(),
  url: new Expr<string>(),
  data: new Expr<Record<string, any>>(),
  searchableText: new Expr<string>()
}

// We can't export the inferred type because the rado depencency types are
// not included in distribution. At least we'll get a type error here if the
// type is out of date.
type EntryFromRow = Expand<EntryRow>
type Assert<A, B extends A> = never
type Run = Assert<EntryFromRow, Entry> | Assert<Entry, EntryFromRow>
