import {Entry, Schema} from '@alinea/core'

export interface Loader {
  extension: string
  parse(schema: Schema, input: Buffer): Entry.Raw
  format(schema: Schema, entry: Entry.Raw): Buffer
}
