import {Collection} from 'helder.store'
import {Draft} from './Draft'
import {Label} from './Label'

export type Id<T> = string & {__t: T}

export interface Entry {
  $id: string
  $parent?: string
  $channel: string
  $isContainer?: boolean
  title: Label
}

export namespace Entry {
  export type WithParents = Entry /* & {$parents: Array<string>}*/
  export type WithChildrenCount = Entry & {childrenCount: number}
  export type WithDraft = {entry: Entry; draft: Draft | null}
}

export const Entry = new Collection<Entry & {id: string}>('Entry')
