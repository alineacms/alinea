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
  language?: string
  robots?: string
  canonical?: string
  'og:url'?: string
  'og:site_name'?: string
  'og:title'?: string
  'og:description'?: string
  'og:image'?: string
  'og:image:width'?: string
  'og:image:height'?: string
  'twitter:card'?: string
  'twitter:title'?: string
  'twitter:image'?: string
  'twitter:image:width'?: string
  'twitter:image:height'?: string
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
