import {Label} from 'alinea/core/Label'
import {Reference} from 'alinea/core/Reference'

export interface EntryLinkReference extends Reference {
  entry: string
}

export interface EntryReference extends EntryLinkReference {
  entryType: string
  path: string
  title: Label
  url: string
}

export namespace EntryReference {
  export function isEntryReference(value: any): value is EntryReference {
    return value && (value.type === 'entry' || value.ref === 'entry')
  }
}

export interface FileReference extends EntryLinkReference {
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
  src: string
  extension: string
  size: number
  hash: string
  width: number
  height: number
  averageColor: string
  blurHash: string
}

export namespace ImageReference {
  export function isImageReference(value: any): value is ImageReference {
    return value && (value.type === 'image' || value.ref === 'image')
  }
}
