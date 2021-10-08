import {Entry, Outcome} from '@alinea/core'

export interface Persistence {
  publish(entries: Array<Entry>): Promise<Outcome<void>>
}
