import {EntryPhase} from './EntryRow.js'
import {Realm} from './pages/Realm.js'
import {Selection} from './pages/ResolveData.js'

export interface ResolveParams extends ResolveDefaults {
  selection: Selection
  location?: Array<string>
  locale?: string
  syncInterval?: number
}

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
  resolve(params: ResolveParams): Promise<unknown>
}
