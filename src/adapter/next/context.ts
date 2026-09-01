import {generatedRelease} from '#/backend/store/GeneratedRelease.js'
import {Config} from '#/core/Config.js'
import {developmentKeyHeader, type RequestContext} from '#/core/Connection.js'
import {Headers} from '@alinea/iso'

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

export function forwardDevelopmentCredentials(
  request: Request | undefined,
  apiKey: string,
  init?: RequestInit
): RequestInit {
  const headers = new Headers(init?.headers)
  const cookie = request?.headers.get('cookie')
  const authorization = request?.headers.get('authorization')
  if (cookie) headers.set('cookie', cookie)
  if (authorization) headers.set('authorization', authorization)
  headers.set(developmentKeyHeader, apiKey)
  return {...init, headers}
}
