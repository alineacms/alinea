import {Reference} from 'alinea/core/Reference'

export interface EntryReference extends Reference {
  _type: 'entry'
  _entry: string
}

export namespace EntryReference {
  export const entry = '_entry' satisfies keyof EntryReference

  export function isEntryReference(value: any): value is EntryReference {
    // type can be entry, image or file
    return value && EntryReference.entry in value
  }
}
