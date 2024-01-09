import {Expand} from 'alinea/core'
import {EntryPhase, EntryRow} from './EntryRow.js'
import {Target} from './pages/Target.js'

export interface Entry {
  entryId: string
  phase: EntryPhase
  title: string
  type: string
  seeded: boolean
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
  modifiedAt: number
  rowHash: string
  active: boolean
  main: boolean
  path: string
  fileHash: string
  url: string
  data: Record<string, any>
  searchableText: string
}
export const Entry = Target.create<Entry>({})

// We can't export the inferred type because the rado depencency types are
// not included in distribution. At least we'll get a type error here if the
// type is out of date.
type EntryFromRow = Expand<EntryRow>
type Assert<A, B extends A> = never
type Run = Assert<EntryFromRow, Entry> | Assert<Entry, EntryFromRow>
