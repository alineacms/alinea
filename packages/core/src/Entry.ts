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
  index: string
  // Computed properties
  workspace: string
  root: string
  url: string
  $status?: EntryStatus
  parent?: string
  parents: Array<string>
  $isContainer?: boolean
}

export namespace Entry {
  export type Detail = {
    entry: Entry
    draft: string | undefined
  }
  export type Summary = Pick<
    Entry,
    | 'id'
    | 'type'
    | 'title'
    | 'index'
    | 'workspace'
    | 'root'
    | 'url'
    | 'parent'
    | 'parents'
    | '$isContainer'
  > & {
    childrenCount: number
  }
  export type Raw = Omit<
    Entry,
    | 'workspace'
    | 'root'
    | 'url'
    | '$status'
    | 'parent'
    | 'parents'
    | '$isContainer'
  >
}

// Todo: export this elsewhere
export const Entry = new Collection<Entry>('Entry')
