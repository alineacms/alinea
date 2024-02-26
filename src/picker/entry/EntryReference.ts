import {Reference} from 'alinea/core/Reference'

export interface EntryReference extends Reference {
  _type: 'entry'
  _entry: string
}

export namespace EntryReference {
  export const entry = '_entry' satisfies keyof EntryReference

  export function isEntryReference(value: any): value is EntryReference {
    return value && value._type === 'entry' && EntryReference.entry in value
  }
}
