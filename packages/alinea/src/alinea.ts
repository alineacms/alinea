// Config creation
export {
  createConfig,
  root,
  Root,
  schema,
  Tree,
  type,
  workspace,
  Workspace
} from '@alinea/core'
export type {Config, Schema, TextDoc, Type} from '@alinea/core'
// Dashboard
export {MediaSchema} from '@alinea/dashboard/schema/MediaSchema'
export {Preview} from '@alinea/dashboard/view/Preview'
export {BrowserPreview} from '@alinea/dashboard/view/preview/BrowserPreview'
// Included inputs
export {check} from '@alinea/input.check'
export {code} from '@alinea/input.code'
export {date} from '@alinea/input.date'
export {link} from '@alinea/input.link'
export {list} from '@alinea/input.list'
export {number} from '@alinea/input.number'
export {object} from '@alinea/input.object'
export {path} from '@alinea/input.path'
export {richText} from '@alinea/input.richtext'
export {select} from '@alinea/input.select'
export {tab, tabs} from '@alinea/input.tabs'
export {text} from '@alinea/input.text'
// Store
export {Collection, Cursor, Expr} from '@alinea/store'

import {Schema} from '@alinea/core'

export type infer<T> = Schema.TypeOf<T>
