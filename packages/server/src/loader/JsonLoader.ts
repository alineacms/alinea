import {Entry} from '@alinea/core/Entry'
import {Schema} from '@alinea/core/Schema'
import {Loader} from '../Loader'

export const JsonLoader: Loader = {
  extension: '.json',
  parse(schema: Schema, input: Buffer) {
    return JSON.parse(input.toString()) as Entry.Raw
  },
  format(schema: Schema, entry: Entry.Raw) {
    return Buffer.from(JSON.stringify(entry, null, '  '))
  }
}
