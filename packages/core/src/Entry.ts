import {Collection} from 'helder.store'
import {Draft} from './Draft'
import {Label} from './Label'

export type Id<T> = string & {__t: T}

export enum EntryStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived'
}

export interface Entry {
  id: string
  type: string
  title: Label
  // Indexed properties
  $path: string
  $status?: EntryStatus
  $parent?: string
  $isContainer?: boolean
}

export namespace Entry {
  export type WithParents = Entry & {parents: Array<string>}
  export type WithChildrenCount = Entry & {childrenCount: number}
  export type WithDraft = {entry: Entry; draft: Draft | null}
}

// Todo: export this elsewhere
export const Entry = new Collection<Entry & {id: string}>('Entry')
