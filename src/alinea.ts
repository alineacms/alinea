import {Schema} from 'alinea/core'
// Config creation
export {createConfig, root, schema, type, workspace} from 'alinea/core'
// Default inputs
export * from './input.js'
export type infer<T> = Schema.TypeOf<T>
