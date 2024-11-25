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
  const baseUrl = Config.baseUrl(config)
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

function requestHeaders(): Promise<Headers> {
  return import(
    // @ts-ignore
    'next/dist/client/components/request-async-storage.external.js'
  )
    .catch(
      () =>
        import(
          'next/dist/server/app-render/work-unit-async-storage.external.js'
        )
    )
    .then(
      ({getExpectedRequestStore}) => getExpectedRequestStore('headers').headers
    )
    .catch(() => new Headers())
}
