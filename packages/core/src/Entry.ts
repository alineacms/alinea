import {Collection} from '@alinea/store'
import {Label} from './Label'

export type Id<T> = string & {__t: T}

export enum EntryStatus {
  Draft = 'draft',
  Published = 'published',
  Publishing = 'publishing',
  Archived = 'archived'
}

export interface EntryMetaRaw {
  // In case this entry has no parent we'll keep a reference to which root it
  // belongs to
  root?: string
  // These fields are stored on disk when using file data
  index: string
  i18n?: {id: string}
}

export interface EntryMeta extends EntryMetaRaw {
  // These are computed during generation
  workspace: string
  root: string
  parent: string | undefined
  parents: Array<string>
  status?: EntryStatus
  isContainer?: boolean
  i18n?: Entry.I18N
}

export interface Entry {
  id: string
  type: string
  url: string
  title: Label
  path: string
  alinea: EntryMeta
}

export namespace Entry {
  export type Detail = {
    entry: Entry
    original: Entry | null
    draft: string | undefined
    previewToken: string
    parent?: Entry.Minimal
    translations?: Array<Entry.Minimal>
  }
  export type I18N = {
    id: string
    locale: string
    parent: string | undefined
    parents: Array<string>
  }
  export type Minimal = Pick<Entry, 'id' | 'type' | 'title' | 'alinea'>
  export type Summary = Pick<Entry, 'id' | 'type' | 'title' | 'alinea'> & {
    childrenCount: number
  }
  export interface Raw {
    id: string
    type: string
    title: Label
    alinea: EntryMetaRaw
  }
}

class EntryCollection extends Collection<Entry> {
  constructor() {
    super('Entry')
  }
  index = this.alinea.index
  root = this.alinea.root
  workspace = this.alinea.workspace
  i18n = this.alinea.i18n
  parent = this.alinea.parent
  parents = this.alinea.parents
}
export const Entry = new EntryCollection()
