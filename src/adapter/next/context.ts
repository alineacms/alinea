import {RequestContext} from 'alinea/backend/Backend'
import {generatedRelease} from 'alinea/backend/store/GeneratedRelease'
import {Config} from 'alinea/core/Config'

export function devUrl() {
  return process.env.ALINEA_DEV_SERVER
}

export async function requestContext(config: Config): Promise<RequestContext> {
  return {
    handlerUrl: await handlerUrl(config),
    apiKey:
      process.env.NODE_ENV === 'development'
        ? 'dev'
        : process.env.ALINEA_API_KEY ?? (await generatedRelease)
  }
}

async function handlerUrl(config: Config) {
  const baseUrl = process.env.ALINEA_BASE_URL ?? Config.baseUrl(config)
  return devUrl()
    ? new URL('/api', devUrl())
    : new URL(
        config.handlerUrl ?? '/api/cms',
        baseUrl ?? (await requestOrigin())
      )
}

async function requestOrigin() {
  const headers = await requestHeaders()
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  const proto = headers.get('x-forwarded-proto') ?? 'https'
  const protocol = proto.endsWith(':') ? proto : proto + ':'
  return `${protocol}//${host}`
}

async function requestHeaders(): Promise<Headers> {
  try {
    const {getExpectedRequestStore} = await import(
      'next/dist/client/components/request-async-storage.external.js'
    )
    return getExpectedRequestStore('headers').headers
  } catch {
    return new Headers()
  }
}
