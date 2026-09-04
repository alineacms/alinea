import {generatedRelease} from '#/backend/store/GeneratedRelease.js'
import {Config} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import {forwardDevelopmentCredentials} from './ForwardCredentials.js'

export async function requestContext(
  config: Config,
  request?: Request
): Promise<RequestContext> {
  const apiKey =
    process.env.ALINEA_API_KEY ||
    (process.env.NODE_ENV === 'development' ? 'dev' : await generatedRelease)
  const dev = process.env.ALINEA_DEV_SERVER
  if (dev) {
    return {
      isDev: true,
      handlerUrl: new URL('/api', dev),
      apiKey,
      applyAuth: init => forwardDevelopmentCredentials(request, apiKey, init)
    }
  }
  const nodeEnv = process.env.NODE_ENV
  const baseUrl = Config.baseUrl(config, nodeEnv)
  if (!baseUrl) throw new Error(`Missing baseUrl in config for ${nodeEnv}`)
  return {
    isDev: false,
    handlerUrl: new URL(Config.handlerUrl(config), baseUrl),
    apiKey
  }
}
