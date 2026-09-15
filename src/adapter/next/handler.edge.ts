import {generatedSource} from '#/backend/store/GeneratedSource.js'
import type {Config} from '#/core/Config.js'
import {EntryStore} from '#/database/EntryStore.js'
import {createHandlerWithDatabase, type NextHandlerOptions} from './handler.js'
import type {NextCMS} from './cms.js'

export type {NextHandlerOptions} from './handler.js'
export {handlerPathname} from './handler.js'

async function generatedDatabase(config: Config): Promise<EntryStore> {
  return EntryStore.memory(config, await generatedSource)
}

/** Serve the handler on Edge through an in-memory WASM replica. */
export function createHandler(input: NextCMS | NextHandlerOptions) {
  return createHandlerWithDatabase(input, generatedDatabase)
}
