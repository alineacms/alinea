// Config creation
export {Root, Workspace} from 'alinea/core'
export type {Config, Infer, Schema, TextDoc, Type} from 'alinea/core'
export * from 'alinea/core/driver/DefaultDriver'
export * from 'alinea/core/driver/NextDriver'
// Dashboard
export {MediaSchema} from 'alinea/core/media/MediaSchema'
export {alinea}
import * as alinea from './alinea.js'
export default alinea
export type {
  EntryReference,
  FileReference,
  ImageReference
} from 'alinea/picker/entry'
export type {UrlReference} from 'alinea/picker/url'
