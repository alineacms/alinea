import {HttpError} from '#/core/HttpError.js'
import {readBody} from '#/core/util/ReadBody.js'
import {
  decodeReferenceBatch,
  type ReferenceRequest
} from '../replica/ReferenceBatch.js'
import type {HttpPayloadLoaderOptions} from './HttpPayloadLoader.js'

export async function fetchReferences(
  options: Pick<HttpPayloadLoaderOptions, 'url' | 'fetch' | 'applyAuth'>,
  request: ReferenceRequest,
  signal: AbortSignal
) {
  signal.throwIfAborted()
  request = structuredClone(request)
  const url = new URL(options.url)
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Invalid replica endpoint')
  url.searchParams.set('action', 'replicaReferences')
  const init: RequestInit = {
    method: 'POST',
    credentials: 'same-origin',
    headers: {accept: 'application/json', 'content-type': 'application/json'},
    body: JSON.stringify(request)
  }
  const response = await (options.fetch ?? fetch)(url.href, {
    ...(options.applyAuth ? options.applyAuth(init) : init),
    cache: 'no-store',
    redirect: 'error',
    signal
  })
  let consumed = false
  try {
    signal.throwIfAborted()
    if (!response.ok)
      throw new HttpError(response.status, 'Replica reference request failed')
    if (
      response.status !== 200 ||
      !response.headers.get('content-type')?.includes('application/json') ||
      !response.body
    )
      throw new Error('Invalid reference response')
    consumed = true
    const bytes = await readBody(response.body, 32 * 1024 * 1024, signal)
    return decodeReferenceBatch(
      JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)),
      request
    )
  } finally {
    if (!consumed) await response.body?.cancel().catch(() => {})
  }
}
