import {Headers, type Request} from '@alinea/iso'

export function proxyMediaUrl(request: Request, source: URL) {
  const headers = new Headers()
  for (const name of [
    'range',
    'if-range',
    'if-none-match',
    'if-modified-since'
  ]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  return fetch(source, {
    method: request.method,
    headers,
    signal: request.signal
  })
}
