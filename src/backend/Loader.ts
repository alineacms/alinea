import type {EntryRecord} from 'alinea/core/EntryRecord'
import type {Schema} from 'alinea/core/Schema'

export interface Loader {
  extension: string
  parse(schema: Schema, input: Uint8Array): EntryRecord
  format(schema: Schema, entry: EntryRecord): Uint8Array
}
