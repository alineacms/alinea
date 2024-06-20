import {EntryPhase, EntryRow} from './EntryRow.js'
import {Realm} from './pages/Realm.js'
import {Selection} from './pages/ResolveData.js'

export type PreviewRequest = PreviewUpdate | {entry: EntryRow}

export interface PreviewUpdate {
  entryId: string
  phase: EntryPhase
  update: string
}

export interface PreviewMetadata {
  title: string
  description?: string
  'og:title'?: string
  'og:description'?: string
  'og:url'?: string
  'og:image'?: string
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
