import {generatedDatabase} from '#/backend/store/GeneratedDatabaseNode.js'
import type {Config} from '#/core/Config.js'
import {NextCMS} from './cms.js'
import {createHandlerWithDatabase, type NextHandlerOptions} from './handler.js'

// Kept out of the alinea/next entry so it stays pure re-exports: a bundler
// can then drop the unused Node-only modules from client chunks.

export function createCMS<Definition extends Config>(
  config: Definition
): NextCMS<Definition> {
  return new NextCMS(config, generatedDatabase)
}

export function createHandler(input: NextCMS | NextHandlerOptions) {
  return createHandlerWithDatabase(input, generatedDatabase)
}
