import type {Reference} from '#/core/Reference.js'

export interface EntryReference extends Reference {
  _type: 'entry' | 'image' | 'file'
  _entry: string
}

export namespace EntryReference {
  export const entry = '_entry' satisfies keyof EntryReference

  export function isEntryReference(value: any): value is EntryReference {
    // type can be entry, image or file
    return value && EntryReference.entry in value
  }
}
