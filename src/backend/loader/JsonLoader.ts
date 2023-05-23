import {Schema} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Loader} from '../Loader.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const JsonLoader: Loader = {
  extension: '.json',
  parse(schema: Schema, input: Uint8Array) {
    return JSON.parse(decoder.decode(input)) as EntryRecord
  },
  format(schema: Schema, entry: EntryRecord) {
    return encoder.encode(JSON.stringify(entry, null, '  '))
  }
}
