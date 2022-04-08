// Config creation
// Backend
export {Backend, Server} from '@alineacms/backend'
export {createConfig, schema, Tree, workspace} from '@alineacms/core'
export type {Config, Schema, TextDoc, Type, Workspace} from '@alineacms/core'
// Dashboard
export {MediaSchema} from '@alineacms/dashboard/schema/MediaSchema'
export {BrowserPreview} from '@alineacms/dashboard/view/preview/BrowserPreview'
// Included inputs
export {code} from '@alineacms/input.code'
export {link} from '@alineacms/input.link'
export {list} from '@alineacms/input.list'
export {number} from '@alineacms/input.number'
export {path} from '@alineacms/input.path'
export {richText} from '@alineacms/input.richtext'
export {select} from '@alineacms/input.select'
export {tab, tabs} from '@alineacms/input.tabs'
export {text} from '@alineacms/input.text'
export type {Collection, Cursor, Expr} from '@alineacms/store'

import type {Store} from '@alineacms/store'
export type TypeOf<T> = Store.TypeOf<T>
