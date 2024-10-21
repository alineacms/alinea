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
  entryId: new Expr<string>(['entryId']),
  phase: new Expr<EntryPhase>(['phase']),
  title: new Expr<string>(['title']),
  type: new Expr<string>(['type']),
  seeded: new Expr<string | null>(['seeded']),
  workspace: new Expr<string>(['workspace']),
  root: new Expr<string>(['root']),
  level: new Expr<number>(['level']),
  filePath: new Expr<string>(['filePath']),
  parentDir: new Expr<string>(['parentDir']),
  childrenDir: new Expr<string>(['childrenDir']),
  index: new Expr<string>(['index']),
  parent: new Expr<string | null>(['parent']),
  i18nId: new Expr<string>(['i18nId']),
  locale: new Expr<string | null>(['locale']),
  rowHash: new Expr<string>(['rowHash']),
  active: new Expr<boolean>(['active']),
  main: new Expr<boolean>(['main']),
  path: new Expr<string>(['path']),
  fileHash: new Expr<string>(['fileHash']),
  url: new Expr<string>(['url']),
  data: new Expr<Record<string, any>>(['data']),
  searchableText: new Expr<string>(['searchableText'])
}

// We can't export the inferred type because the rado depencency types are
// not included in distribution. At least we'll get a type error here if the
// type is out of date.
type EntryFromRow = Expand<EntryRow>
type Assert<A, B extends A> = never
type Run = Assert<EntryFromRow, Entry> | Assert<Entry, EntryFromRow>
