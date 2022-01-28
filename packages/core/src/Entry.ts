import {Collection} from 'helder.store'
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
  url: string
  title: Label
  // Computed properties
  $status?: EntryStatus
  $parent?: string
  $isContainer?: boolean
}

export namespace Entry {
  export type Detail = {
    entry: Entry
    parents: Array<string>
    draft: string | undefined
  }
  export type Summary = Pick<
    Entry,
    'id' | 'type' | 'title' | 'url' | '$parent' | '$isContainer'
  > & {
    childrenCount: number
  }
  export type Raw = Omit<Entry, 'url' | '$status' | '$parent' | '$isContainer'>
}

// Todo: export this elsewhere
export const Entry = new Collection<Entry>('Entry')
