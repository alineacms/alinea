import {RequestContext} from 'alinea/backend/Backend'
import {generatedRelease} from 'alinea/backend/store/GeneratedRelease'
import {Config} from 'alinea/core/Config'
import {type ReadonlyRequestCookies} from 'next/dist/server/web/spec-extension/adapters/request-cookies.js'

export function devUrl() {
  return process.env.ALINEA_DEV_SERVER
}

export async function requestContext(config: Config): Promise<RequestContext> {
  const url = await handlerUrl(config)
  const cookies = await requestCookies()
  const apiKey =
    process.env.NODE_ENV === 'development'
      ? 'dev'
      : process.env.ALINEA_API_KEY ?? (await generatedRelease)
  const context = {
    handlerUrl: url,
    apiKey,
    applyAuth: (init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      const ourCookies = cookies
        ?.getAll()
        .filter(({name}) => name.startsWith('alinea'))
      if (ourCookies)
        for (const {name, value} of ourCookies)
          headers.append('cookie', `${name}=${value}`)
      headers.set('Authorization', `Bearer ${apiKey}`)
      return {...init, headers}
    }
  }
  return context
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

function asyncLocalStorage() {
  return import(
    // @ts-ignore
    'next/dist/client/components/request-async-storage.external.js'
  ).catch(
    () =>
      import('next/dist/server/app-render/work-unit-async-storage.external.js')
  )
}

function requestCookies(): Promise<ReadonlyRequestCookies | undefined> {
  return asyncLocalStorage()
    .then(
      ({getExpectedRequestStore}) => getExpectedRequestStore('cookies').cookies
    )
    .catch(() => undefined)
}

function requestHeaders(): Promise<Headers> {
  return asyncLocalStorage()
    .then(
      ({getExpectedRequestStore}) => getExpectedRequestStore('headers').headers
    )
    .catch(() => new Headers())
}
