import {Entry, Outcome} from '@alinea/core'

export interface Persistence {
  persist(entries: Array<Entry>): Promise<Outcome<void>>
}
