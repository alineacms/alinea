import type {EntryRecord} from '#/core/EntryRecord.js'
import type {Schema} from '#/core/Schema.js'

export interface Loader {
  extension: string
  parse(schema: Schema, input: Uint8Array): EntryRecord
  format(schema: Schema, entry: EntryRecord): Uint8Array
}
