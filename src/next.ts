import {NextCMS} from '#/adapter/next/cms.js'
import {
  createHandlerWithDatabase,
  type NextHandlerOptions
} from '#/adapter/next/handler.js'
import {generatedDatabase} from '#/backend/store/GeneratedDatabaseNode.js'
import type {Config} from '#/core/Config.js'

export type {SyncStatus} from '#/adapter/next/cms.js'
export type {NextHandlerOptions} from '#/adapter/next/handler.js'
export type {
  AfterCommitContext,
  BeforeCommitContext
} from '#/backend/Handler.js'
export {withAlinea} from '#/adapter/next/with-alinea.js'

export function createCMS<Definition extends Config>(
  config: Definition
): NextCMS<Definition> {
  return new NextCMS(config, generatedDatabase)
}

export function createHandler(input: NextCMS | NextHandlerOptions) {
  return createHandlerWithDatabase(input, generatedDatabase)
}
