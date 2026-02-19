//import {fetch, Request, Response} from '@alinea/iso'

const hopByHopHeaders = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]

export const proxy: typeof fetch = async (input, init) => {
  const request = new Request(input, init)
  request.headers.delete('accept-encoding')
  const response = await fetch(request)
  const headers = new Headers(response.headers)
  for (const header of hopByHopHeaders) headers.delete(header)
  if (headers.has('content-encoding')) {
    headers.delete('content-encoding')
    headers.delete('content-length')
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  })
}
