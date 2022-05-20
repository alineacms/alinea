import {Collection} from '@alinea/store'
import {Label} from './Label'

export type Id<T> = string & {__t: T}

export enum EntryStatus {
  Draft = 'draft',
  Published = 'published',
  Publishing = 'publishing',
  Archived = 'archived'
}

export interface Entry {
  id: string
  type: string
  title: Label
  path: string
  index: string
  workspace: string
  root: string
  url: string
  parent: string | undefined
  parents: Array<string>
  $status?: EntryStatus
  $isContainer?: boolean
  i18n?: Entry.I18N
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
  export type Minimal = Pick<
    Entry,
    'id' | 'type' | 'title' | 'workspace' | 'root' | 'url' | 'parent' | 'i18n'
  >
  export type Summary = Pick<
    Entry,
    | 'id'
    | 'type'
    | 'title'
    | 'workspace'
    | 'root'
    | 'url'
    | 'index'
    | 'parent'
    | 'i18n'
    | 'parents'
    | '$isContainer'
  > & {
    childrenCount: number
  }
  export type Raw = Omit<
    Entry,
    | 'path'
    | 'workspace'
    | 'root'
    | 'url'
    | '$status'
    | 'parent'
    | 'parents'
    | '$isContainer'
    | 'i18n'
  > & {i18n?: {id: string}}
  // & {[key: string]: any}
}

export const Entry = new Collection<Entry>('Entry')
