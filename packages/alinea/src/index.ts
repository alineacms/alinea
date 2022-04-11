// Config creation
export {createConfig, schema, type, Tree, workspace} from '@alinea/core'
export type {Config, Schema, TextDoc, Type, Workspace} from '@alinea/core'

// Backend
export {Backend, Server} from '@alinea/backend'

// Dashboard
export {MediaSchema} from '@alinea/dashboard/schema/MediaSchema'
export {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview'

// Included inputs
export {code} from '@alinea/input.code'
export {link} from '@alinea/input.link'
export {list} from '@alinea/input.list'
export {number} from '@alinea/input.number'
export {path} from '@alinea/input.path'
export {richText} from '@alinea/input.richtext'
export {select} from '@alinea/input.select'
export {tab, tabs} from '@alinea/input.tabs'
export {text} from '@alinea/input.text'

// Store
export {Collection, Cursor, Expr} from '@alinea/store'
import type {Store} from '@alinea/store'
export type TypeOf<T> = Store.TypeOf<T>
