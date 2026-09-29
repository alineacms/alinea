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
  // Protected deployments (eg. Vercel previews) only serve their own files to
  // the visitor that is signed in to them
  const cookie = request.headers.get('cookie')
  if (cookie && source.origin === new URL(request.url).origin)
    headers.set('cookie', cookie)
  return fetch(source, {
    method: request.method,
    headers,
    signal: request.signal
  })
}
