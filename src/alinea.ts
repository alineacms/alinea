// Config creation
export {createConfig as config} from 'alinea/core/Config'
export {Meta as meta} from 'alinea/core/Meta'
export {page} from 'alinea/core/Page'
export {root} from 'alinea/core/Root'
export {schema} from 'alinea/core/Schema'
export {track} from 'alinea/core/Tracker'
export {type} from 'alinea/core/Type'
export {workspace} from 'alinea/core/Workspace'
export {snippet} from 'alinea/core/pages/Snippet'

// Types

export type {Config} from 'alinea/core/Config'
export type {Infer} from 'alinea/core/Infer'
export {Root} from 'alinea/core/Root'
export type {Schema} from 'alinea/core/Schema'
export type {TextDoc} from 'alinea/core/TextDoc'
export type {Type} from 'alinea/core/Type'
export {Workspace} from 'alinea/core/Workspace'
export type {EntryLink} from 'alinea/field/link/EntryLink'
export type {FileLink} from 'alinea/field/link/FileLink'
export type {ImageLink} from 'alinea/field/link/ImageLink'
export type {UrlLink} from 'alinea/field/link/UrlLink'
export type {EntryReference} from 'alinea/picker/entry/EntryReference'
export type {UrlReference} from 'alinea/picker/url'

// Helpers
export {document} from 'alinea/core/Document'
export type {Infer as infer} from 'alinea/core/Infer'
export {createMediaRoot as media} from 'alinea/core/media/MediaRoot'

// Included inputs
export * from './field.js'
