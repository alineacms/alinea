import {Config} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import {hashBlob} from '#/core/source/GitUtils.js'

const encoder = new TextEncoder()

async function internalToken(): Promise<string> {
  const sourceId = process.env.ALINEA_SOURCE_ID
  if (!sourceId) {
    if (process.env.NODE_ENV === 'development') return 'dev'
    throw new Error('Missing Alinea source release id')
  }
  return hashBlob(encoder.encode(`alinea-internal:${sourceId}`))
}

export async function requestContext(config: Config): Promise<RequestContext> {
  const dev = process.env.ALINEA_DEV_SERVER
  if (dev)
    return {
      isDev: true,
      handlerUrl: new URL('/api', dev),
      apiKey: process.env.ALINEA_API_KEY || '',
      internalToken: 'dev'
    }
  const nodeEnv = process.env.NODE_ENV
  const baseUrl = Config.baseUrl(config, nodeEnv)
  if (!baseUrl) throw new Error(`Missing baseUrl in config for ${nodeEnv}`)
  return {
    isDev: false,
    handlerUrl: new URL(config.handlerUrl ?? '/api/cms', baseUrl),
    apiKey: process.env.ALINEA_API_KEY || '',
    internalToken: await internalToken()
  }
}
