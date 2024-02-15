import {Reference} from 'alinea/core/Reference'

export interface EntryReference extends Reference {
  _entry: string
  // These fields are queried from the target entry by default
  i18nId: string
  title: string
  entryType: string
  path: string
  url: string
}

export namespace EntryReference {
  export const entry = '_entry' satisfies keyof EntryReference
}

export namespace EntryReference {
  export function isEntryReference(value: any): value is EntryReference {
    return value && EntryReference.entry in value
  }
}

export interface FileReference extends Reference {
  _entry: string
  // These fields are queried from the target entry by default
  title: string
  src: string
  url: string
  extension: string
  size: number
}

export interface ImageReference extends Reference {
  _entry: string
  // These fields are queried from the target entry by default
  title: string
  src: string
  extension: string
  size: number
  hash: string
  width: number
  height: number
  averageColor: string
  thumbHash: string
  focus: {x: number; y: number}
}
