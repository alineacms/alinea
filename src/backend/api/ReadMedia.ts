import {Headers, type Request, Response} from '@alinea/iso'

export async function readMediaUrl(
  request: Request,
  source: URL
): Promise<Response> {
  const headers = new Headers()
  for (const name of ['range', 'if-none-match', 'if-modified-since']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const origin = source.origin
  let current = source
  for (let redirects = 0; ; redirects++) {
    if (current.origin !== origin)
      return new Response('Invalid media source', {status: 502})
    const response = await fetch(current, {
      method: request.method,
      headers,
      redirect: 'manual',
      signal: request.signal
    })
    const location = response.headers.get('location')
    if (![301, 302, 303, 307, 308].includes(response.status) || !location)
      return response
    if (redirects === 3)
      return new Response('Too many media redirects', {status: 502})
    current = new URL(location, current)
  }
}
