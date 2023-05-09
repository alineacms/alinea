import {Entry, Schema} from 'alinea/core'

export interface Loader {
  extension: string
  parse(schema: Schema, input: Uint8Array): Entry.Raw
  format(schema: Schema, entry: Entry.Raw): Uint8Array
}
