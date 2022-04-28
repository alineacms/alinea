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
  i18nId?: string
  locale?: string
  $status?: EntryStatus
  $isContainer?: boolean
}

export namespace Entry {
  export type Detail = {
    entry: Entry
    draft: string | undefined
    previewToken: string
    parent?: Entry.Minimal
    translations?: Array<Entry.Minimal>
  }
  export type Minimal = Pick<
    Entry,
    'id' | 'type' | 'title' | 'workspace' | 'root' | 'url' | 'parent' | 'locale'
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
    | 'locale'
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
  >
}

export const Entry = new Collection<Entry>('Entry')
