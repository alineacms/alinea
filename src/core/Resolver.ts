import {Connection} from './Connection.js'
import {EntryPhase} from './EntryRow.js'
import {Realm} from './pages/Realm.js'

export interface PreviewUpdate {
  entryId: string
  phase: EntryPhase
  update: string
}

export interface ResolveDefaults {
  realm?: Realm
  preview?: PreviewUpdate
  syncInterval?: number
}

export interface Resolver {
  resolve(params: Connection.ResolveParams): Promise<unknown>
}
