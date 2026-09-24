import {fetch} from '@alinea/iso'

// Headers that describe the incoming connection, not the proxied request
const connectionHeaders = [
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'transfer-encoding',
  'upgrade'
]

/**
 * Proxies the dashboard and its files to the dev server of the Alinea CLI,
 * which sets ALINEA_DEV_SERVER and ALINEA_ADMIN_PATH for the framework it
 * runs (`alinea dev -- <command>`). The dev server only listens locally, so
 * everything, including the long-lived `~dev` event stream, is proxied
 * instead of redirected. Undefined for other requests and outside
 * development.
 */
export function devProxy(request: Request): Promise<Response> | undefined {
  const devServer = process.env.ALINEA_DEV_SERVER
  const adminPath = process.env.ALINEA_ADMIN_PATH
  if (!devServer || !adminPath) return
  const url = new URL(request.url)
  const filePrefix = `${adminPath}/file/`
  let target: URL
  if (url.pathname.startsWith(filePrefix)) {
    target = new URL('/api', devServer)
    const file = url.pathname.slice(filePrefix.length)
    target.searchParams.set('file', decode(file))
    target.searchParams.set('delivery', 'proxy')
  } else if (
    url.pathname === adminPath ||
    url.pathname.startsWith(`${adminPath}/`)
  ) {
    target = new URL(`${url.pathname}${url.search}`, devServer)
  } else {
    return
  }
  const headers = new Headers(request.headers)
  for (const name of connectionHeaders) headers.delete(name)
  // Fetch decodes compressed bodies but keeps their headers
  headers.set('accept-encoding', 'identity')
  // The dev server forwards dashboard mutations to the site's handler here
  if (!headers.has('x-forwarded-host'))
    headers.set('x-forwarded-host', url.host)
  if (!headers.has('x-forwarded-proto'))
    headers.set('x-forwarded-proto', url.protocol.slice(0, -1))
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const init: RequestInit & {duplex?: 'half'} = {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
    signal: request.signal
  }
  // Frameworks may add headers, which fetch responses do not allow
  return fetch(target, init).then(
    response => new Response(response.body, response)
  )
}

function decode(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}
