import {EntryPhase, EntryRow} from './EntryRow.js'
import {Realm} from './pages/Realm.js'
import {Selection} from './pages/ResolveData.js'

export type PreviewRequest = PreviewUpdate | {entry: EntryRow}

export interface PreviewUpdate {
  entryId: string
  phase: EntryPhase
  update: string
}

export interface ResolveRequest {
  selection: Selection
  location?: Array<string>
  locale?: string
  syncInterval?: number
  realm?: Realm
  preview?: PreviewRequest
}

export type ResolveDefaults = Partial<ResolveRequest>

export interface Resolver {
  resolve(params: ResolveRequest): Promise<unknown>
}
