import {Entry} from '@alinea/core'

export interface Source {
  entries(): AsyncGenerator<Entry>
}
