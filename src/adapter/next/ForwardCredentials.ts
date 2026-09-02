import {developmentKeyHeader} from '#/core/Connection.js'
import {Headers} from '@alinea/iso'

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
