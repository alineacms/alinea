import {generatedRelease} from 'alinea/backend/store/GeneratedRelease'
import {Config} from 'alinea/core/Config'
import type {RequestContext} from 'alinea/core/Connection'

export async function requestContext(config: Config): Promise<RequestContext> {
  const apiKey =
    process.env.NODE_ENV === 'development'
      ? 'dev'
      : (process.env.ALINEA_API_KEY ?? (await generatedRelease))
  const dev = process.env.ALINEA_DEV_SERVER
  if (dev) return {isDev: true, handlerUrl: new URL('/api', dev), apiKey}
  const nodeEnv = process.env.NODE_ENV
  const baseUrl = Config.baseUrl(config, nodeEnv)
  if (!baseUrl) throw new Error(`Missing baseUrl in config for ${nodeEnv}`)
  return {
    isDev: false,
    handlerUrl: new URL(config.handlerUrl ?? '/api/cms', baseUrl),
    apiKey:
      process.env.NODE_ENV === 'development'
        ? 'dev'
        : (process.env.ALINEA_API_KEY ?? (await generatedRelease))
  }
}
