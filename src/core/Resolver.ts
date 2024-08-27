import {EntryRow} from './EntryRow.js'
import {Realm} from './pages/Realm.js'
import {Selection} from './pages/ResolveData.js'

export type PreviewRequest = PreviewPayload | {entry: EntryRow}

export interface PreviewPayload {
  payload: string
}

export interface PreviewUpdate {
  entryId: string
  contentHash: string
  phase: string
  update: Uint8Array
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
  preview?: {entry: EntryRow} | {payload: string}
}

export interface ResolveParams extends ResolveRequest {
  preview?: {payload: string}
}

export type ResolveDefaults = Partial<ResolveParams>

export interface Resolver {
  resolve(params: ResolveRequest): Promise<unknown>
}
