import {Entry, Schema} from '@alinea/core'
import {Loader} from '../Loader'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const JsonLoader: Loader = {
  extension: '.json',
  parse(schema: Schema, input: Uint8Array) {
    return JSON.parse(decoder.decode(input)) as Entry.Raw
  },
  format(schema: Schema, entry: Entry.Raw) {
    return encoder.encode(JSON.stringify(entry, null, '  '))
  }
}
