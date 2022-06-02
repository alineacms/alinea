import * as fetch from '@web-std/fetch'
import http from 'http'
import {TLSSocket} from 'node:tls'
import type {Writable} from 'stream'

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

async function apply(response: Response, to: http.ServerResponse) {
  to.statusCode = response.status
  response.headers.forEach((value, key) => to.setHeader(key, value))
  if (response.body) await writeReadableStreamToWritable(response.body, to)
  else to.end()
}

function fromNodeRequest(request: http.IncomingMessage) {
  const headers = new fetch.Headers()
  for (const key of Object.keys(request.headers)) {
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
  const init: RequestInit = {
    method: request.method!,
    headers
  }
  const protocol =
    request.socket instanceof TLSSocket && request.socket.encrypted
      ? 'https'
      : 'http'
  const url = `${protocol}://${request.headers.host}${request.url}`
  if (request.method !== 'GET' && request.method !== 'HEAD')
    init.body = request as any
  return new fetch.Request(url, init)
}

export function nodeHandler(
  handler: (
    request: Request
  ) => Promise<Response | undefined> | Response | undefined
) {
  return async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: () => void
  ) => {
    const request = fromNodeRequest(req)
    const result = await handler(request)
    if (result) await apply(result, res)
    else next()
  }
}
