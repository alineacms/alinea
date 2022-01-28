import {Entry} from '@alinea/core'

export interface Loader {
  extension: string
  parse(input: Buffer): Entry.Raw
  format(entry: Entry.Raw): Buffer
}
