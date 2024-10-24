import {Entry} from 'alinea/core/Entry'
import {ComponentType} from 'react'
import {EntryRow} from './EntryRow.js'

export type Preview = boolean | ComponentType<{entry: Entry}>

export interface PreviewPayload {
  payload: string
}

export type PreviewRequest = PreviewPayload | {entry: EntryRow}

export interface PreviewUpdate {
  entryId: string
  contentHash: string
  status: string
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
