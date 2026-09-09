import {HttpError} from '#/core/HttpError.js'
import {readBody} from '#/core/util/ReadBody.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import {decodeBootstrap, type ExpectedReplica} from './DecodeBootstrap.js'
import type {HttpPayloadLoaderOptions} from './HttpPayloadLoader.js'

export interface FetchBootstrapOptions extends Pick<
  HttpPayloadLoaderOptions,
  'url' | 'fetch' | 'applyAuth'
> {
  expected: ExpectedReplica
  signal?: AbortSignal
  maximumBytes?: number
}

/** A fresh authenticated response is required even when a disk cache exists. */
export async function fetchBootstrap(
  options: FetchBootstrapOptions
): Promise<IndexBootstrap> {
  const {signal, maximumBytes = 64 * 1024 * 1024} = options
  signal?.throwIfAborted()
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1)
    throw new Error('Invalid bootstrap byte limit')
  const expected = {...options.expected}
  const url = new URL(options.url)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Invalid replica endpoint')
  url.searchParams.set('action', 'replicaIndex')
  const init: RequestInit = {
    method: 'POST',
    credentials: 'same-origin',
    headers: {accept: 'application/json'}
  }
  const response = await (options.fetch ?? fetch)(url.href, {
    ...(options.applyAuth ? options.applyAuth(init) : init),
    cache: 'no-store',
    redirect: 'error',
    signal
  })
  let consumed = false
  try {
    signal?.throwIfAborted()
    if (!response.ok)
      throw new HttpError(response.status, 'Replica bootstrap request failed')
    if (
      response.status !== 200 ||
      !response.headers.get('content-type')?.includes('application/json') ||
      !response.body
    )
      throw new Error('Invalid replica bootstrap response')
    consumed = true
    const bytes = await readBody(response.body, maximumBytes, signal)
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', {fatal: true}).decode(bytes)
    )
    signal?.throwIfAborted()
    return decodeBootstrap(value, expected)
  } finally {
    if (!consumed) await response.body?.cancel().catch(() => {})
  }
}
