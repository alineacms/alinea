import {Label} from './Label'

export type Id<T> = string & {__t: T}

export interface Entry {
  $channel: string
  path: string
  isContainer?: boolean
  title: Label
  parent?: string
}

export namespace Entry {
  export type WithChildrenCount = Entry & {childrenCount: number}
}
