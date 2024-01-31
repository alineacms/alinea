// Config creation
export {
  createConfig as config,
  Meta as meta,
  page,
  root,
  schema,
  snippet,
  track,
  type,
  workspace
} from 'alinea/core'

// Types

export {Root, Workspace} from 'alinea/core'
export type {Config, Infer, Schema, TextDoc, Type} from 'alinea/core'
export type {
  EntryReference,
  FileReference,
  ImageReference
} from 'alinea/picker/entry/EntryReference'
export type {UrlReference} from 'alinea/picker/url'

// Helpers
export type {Infer as infer} from 'alinea/core'
export {document} from 'alinea/core/Document'
export {createMediaRoot as media} from 'alinea/core/media/MediaRoot'

// Included inputs
export * from './input.js'
