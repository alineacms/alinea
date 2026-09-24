import {
  createServerHandler,
  type Handler,
  type OpenGeneratedDatabase,
  type ServerHandlerOptions
} from '#/adapter/core/ServerHandler.js'
import type {NextCMS} from './cms.js'
import {nextHost} from './host.js'

export interface NextHandlerOptions extends ServerHandlerOptions {
  cms: NextCMS
}

export function createHandlerWithDatabase(
  input: NextCMS | NextHandlerOptions,
  openGeneratedDatabase?: OpenGeneratedDatabase
): Handler {
  return createServerHandler(input, nextHost, openGeneratedDatabase)
}

/** A handler without a generated database, as used in the Edge runtime. */
export function createHandler(input: NextCMS | NextHandlerOptions): Handler {
  return createHandlerWithDatabase(input)
}
