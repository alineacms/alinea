// Config creation
export {createConfig, schema, type, Tree, workspace, Workspace, root, Root} from '@alinea/core'
export type {Config, Schema, TextDoc, Type} from '@alinea/core'

// Dashboard
export {MediaSchema} from '@alinea/dashboard/schema/MediaSchema'
export {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview'

// Included inputs
export {code} from '@alinea/input.code'
export {check} from '@alinea/input.check'
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

// Used in init template
export {Welcome} from './Welcome'
