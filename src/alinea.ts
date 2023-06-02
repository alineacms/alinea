import {Schema} from 'alinea/core'
// Config creation
export {
  createConfig,
  Meta as meta,
  page,
  root,
  schema,
  type,
  workspace
} from 'alinea/core'
// Default inputs
export * from './input.js'
export type infer<T> = Schema.Infer<T>
