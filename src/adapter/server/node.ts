import {ServerCMS} from '#/adapter/core/ServerCMS.js'
import {
  createServerHandler,
  type Handler,
  type ServerHandlerOptions
} from '#/adapter/core/ServerHandler.js'
import {generatedDatabase} from '#/backend/store/GeneratedDatabaseNode.js'
import type {Config} from '#/core/Config.js'
import {requestHost} from './RequestHost.js'

export function createCMS<Definition extends Config>(
  config: Definition
): ServerCMS<Definition> {
  return new ServerCMS(config, requestHost(config), generatedDatabase)
}

export function createHandler(
  input: ServerCMS | ServerHandlerOptions
): Handler {
  const cms = input instanceof ServerCMS ? input : input.cms
  return createServerHandler(input, requestHost(cms.config), generatedDatabase)
}
