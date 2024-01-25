import {Reference} from 'alinea/core/Reference'

export interface EntryLinkReference extends Reference {
  entry: string
}

export interface EntryReference extends EntryLinkReference {
  i18nId: string
  title: string
  entryType: string
  path: string
  url: string
}

export namespace EntryReference {
  export function isEntryReference(value: any): value is EntryReference {
    return value && 'entry' in value
  }
}

export interface FileReference extends EntryLinkReference {
  title: string
  src: string
  url: string
  extension: string
  size: number
}

export namespace FileReference {
  export function isFileReference(value: any): value is FileReference {
    return value && (value.type === 'file' || value.ref === 'file')
  }
}

export interface ImageReference extends EntryLinkReference {
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

export namespace ImageReference {
  export function isImageReference(value: any): value is ImageReference {
    return value && (value.type === 'image' || value.ref === 'image')
  }
}
