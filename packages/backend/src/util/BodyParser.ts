// Adapted from: https://github.com/vercel/micro/blob/9e0fbdaacd2681afda232308fdeb04fc8e87a05a/packages/micro/lib/index.js

import {createError, ErrorCode} from '@alinea/core'
import contentType from 'content-type'
import {IncomingMessage} from 'http'
import getRawBody from 'raw-body'

type ParseOptions = {
  limit?: string
  encoding?: BufferEncoding
}

function getExistingBody(req: IncomingMessage & {body?: any}) {
  // The body may have been pre-parsed by middleware we don't control
  if ('body' in req) return req.body
}

export async function parseBuffer(
  req: IncomingMessage,
  options: ParseOptions = {}
): Promise<Buffer | string> {
  const existingBody = getExistingBody(req)
  if (existingBody) return existingBody
  const limit = options.limit || '25mb'
  const type = req.headers['content-type'] || 'text/plain'
  const length = req.headers['content-length']
  const encoding =
    options.encoding || contentType.parse(type).parameters.charset

  return getRawBody(req, {limit, length, encoding}).catch(err => {
    if (err.type === 'entity.too.large') {
      throw createError(ErrorCode.PayloadTooLarge)
    } else {
      throw createError(ErrorCode.BadRequest, err)
    }
  })
}

export async function parseText(
  req: IncomingMessage,
  options: ParseOptions = {}
) {
  const existingBody = getExistingBody(req)
  if (existingBody) return existingBody
  const buf = await parseBuffer(req, options)
  return buf.toString(options?.encoding)
}

export async function parseJson(
  req: IncomingMessage,
  options: ParseOptions = {}
) {
  const existingBody = getExistingBody(req)
  if (existingBody) return existingBody
  const body = await parseText(req, options)
  if (typeof body === 'string') return JSON.parse(body)
  throw createError(ErrorCode.BadRequest, 'Expected string')
}
