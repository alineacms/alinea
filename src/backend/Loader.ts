import {Schema} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'

export interface Loader {
  extension: string
  parse(schema: Schema, input: Uint8Array): EntryRecord
  format(schema: Schema, entry: EntryRecord): Uint8Array
}
