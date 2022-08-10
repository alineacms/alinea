import {Collection} from '@alinea/store'
import {Label} from './Label'

export type Id<T> = string & {__t: T}

export enum EntryStatus {
  Draft = 'draft',
  Published = 'published',
  Publishing = 'publishing',
  Archived = 'archived'
}

export interface EntryMeta {
  // These fields are stored when using file data
  id: string
  type: string
  url: string
  index: string
  root: string
  i18n?: Entry.I18N
  // These are computed during generation
  workspace: string
  parent: string | undefined
  parents: Array<string>
  $status?: EntryStatus
  $isContainer?: boolean
}

export interface Entry {
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
  export type Minimal = Pick<Entry, 'title' | 'alinea'>
  export type Summary = Pick<Entry, 'title' | 'alinea'> & {
    childrenCount: number
  }
  export interface Raw {
    title: Label
    alinea: {
      id: string
      type: string
      index: string
      root: string
      i18n?: {id: string}
    }
  }
}

const collection = new Collection<Entry>('Entry')
export const Entry = Object.assign(collection, {
  id: collection.alinea.id,
  type: collection.alinea.type,
  url: collection.alinea.url,
  index: collection.alinea.index,
  root: collection.alinea.root,
  workspace: collection.alinea.workspace,
  i18n: collection.alinea.i18n,
  parent: collection.alinea.parent,
  parents: collection.alinea.parents
})
