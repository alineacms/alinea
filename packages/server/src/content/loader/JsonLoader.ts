import {Entry} from '@alinea/core/Entry'
import {Loader} from '../Source'

export const JsonLoader: Loader = {
  extension: '.json',
  parse(input: Buffer) {
    return JSON.parse(input.toString()) as Entry.Raw
  },
  format(entry: Entry.Raw) {
    return Buffer.from(JSON.stringify(entry))
  }
}
