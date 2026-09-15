import {generatedDatabase} from '#/backend/store/GeneratedDatabaseNode.js'
import {createHandlerWithDatabase, type NextHandlerOptions} from './handler.js'
import type {NextCMS} from './cms.js'

export type {NextHandlerOptions} from './handler.js'
export {handlerPathname} from './handler.js'

export function createHandler(input: NextCMS | NextHandlerOptions) {
  return createHandlerWithDatabase(input, generatedDatabase)
}
