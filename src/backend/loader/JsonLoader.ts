import type {EntryRecord} from 'alinea/core/EntryRecord'
import type {Schema} from 'alinea/core/Schema'
import type {Loader} from '../Loader.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const JsonLoader: Loader = {
  extension: '.json',
  parse(schema: Schema, input: Uint8Array) {
    const raw = JSON.parse(decoder.decode(input))
    return raw as EntryRecord
  },
  format(schema: Schema, entry: EntryRecord) {
    return encoder.encode(JSON.stringify(entry, null, '  '))
  }
}
