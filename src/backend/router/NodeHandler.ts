import {Headers, Request, Response} from '@alinea/iso'
import http from 'node:http'
import type {Writable} from 'node:stream'
import {TLSSocket} from 'node:tls'

// Source: https://github.com/remix-run/remix/blob/4b11c6d12309ba5a1f3be4f716739f3240f21c35/packages/remix-node/stream.ts#L4
async function writeReadableStreamToWritable(
  stream: ReadableStream,
  writable: Writable
) {
  const reader = stream.getReader()
  async function read() {
    const {done, value} = await reader.read()
    if (done) return writable.end()
    writable.write(value)
    await read()
  }
  try {
    await read()
  } catch (error: any) {
    writable.destroy(error)
    throw error
  }
}

export async function respondTo(to: http.ServerResponse, response: Response) {
  to.statusCode = response.status
  response.headers.forEach((value, key) => to.setHeader(key, value))
  if (response.body) {
    await writeReadableStreamToWritable(response.body, to)
  }
  to.end()
}

const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive'])

export function fromNodeRequest(request: http.IncomingMessage) {
  const headers = new Headers()
  for (const key of Object.keys(request.headers)) {
    if (skipHeaders.has(key)) continue
    if (!(key in request.headers)) continue
    const value = request.headers[key]
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v)
      }
    } else {
      headers.set(key, value)
    }
  }
  const init: RequestInit & {duplex: 'half'} = {
    method: request.method!,
    headers,
    duplex: 'half'
  }
  const protocol =
    request.socket instanceof TLSSocket && request.socket.encrypted
      ? 'https'
      : 'http'
  const url = `${protocol}://${request.headers.host}${
    (request as any).originalUrl || request.url
  }`
  if (request.method !== 'GET' && request.method !== 'HEAD')
    init.body = request as any
  return new Request(url, init)
}

export function nodeHandler(
  handler: (
    request: Request
  ) => Promise<Response | undefined> | Response | undefined
) {
  return async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next?: () => void
  ) => {
    const request = fromNodeRequest(req)
    const result = await handler(request)
    if (result) {
      await respondTo(res, result)
    } else if (next) {
      next()
    } else {
      res.statusCode = 404
      res.end('Not found')
    }
  }
}
