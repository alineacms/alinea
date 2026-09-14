import {Headers, type Request, Response} from '@alinea/iso'

export async function readMediaUrl(
  request: Request,
  source: URL,
  isAllowed: (url: URL) => boolean = url => url.origin === source.origin
): Promise<Response> {
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
  let current = source
  for (let redirects = 0; ; redirects++) {
    if (!isAllowed(current))
      return new Response('Invalid media source', {status: 502})
    const response = await fetch(current, {
      method: request.method,
      headers,
      redirect: 'manual',
      signal: request.signal
    })
    const location = response.headers.get('location')
    if (!isRedirectStatus(response.status) || !location) return response
    if (redirects === 3)
      return new Response('Too many media redirects', {status: 502})
    current = new URL(location, current)
  }
}

export function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  )
}
