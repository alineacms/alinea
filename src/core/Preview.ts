import type {ComponentType} from 'react'
import type {Entry} from './Entry.js'
import type {EntryRecord} from './EntryRecord.js'

export type Preview = boolean | ComponentType<{entry: Entry}>

export interface PreviewPayload {
  payload: string
}

export type PreviewRequest = PreviewPayload | {entry: Entry}

/** A preview as a patch of the entry's file, from before `PreviewDelta` */
export interface PreviewUpdate {
  locale: string | null
  entryId: string
  contentHash: string
  status: string
  patch: Uint8Array
}

/**
 * A preview as a delta of the entry's record, both written as JSON, from
 * the row the server built from the file named by `fileHash`. It does not
 * depend on how the file is formatted, and a keystroke costs a few bytes.
 */
export interface PreviewDelta {
  version: 2
  locale: string | null
  entryId: string
  /** The content the dashboard previews on, for a server that is behind */
  contentHash: string
  status: string
  /** The sha of the file the base row was built from */
  fileHash: string
  /** A patch (`createFilePatch`) from the base record to the draft */
  delta: Uint8Array
  /** The whole draft, for a server whose row is of another version */
  record?: EntryRecord
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
