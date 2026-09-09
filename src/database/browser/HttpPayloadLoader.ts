import {HttpError} from '#/core/HttpError.js'
import {readBody} from '#/core/util/ReadBody.js'
import pLimit from 'p-limit'
import {
  payloadBatchLimit,
  type PayloadBatchRequest
} from '../replica/PayloadBatch.js'
import type {LoadedPayload, PayloadRequest} from '../runtime/EntryRuntime.js'
import type {ReplicaCache, ReplicaIdentity} from './ReplicaCache.js'
import {decodePayloadBatch} from './DecodePayloadBatch.js'
import {PayloadLoader} from './PayloadLoader.js'

export interface HttpPayloadLoaderOptions {
  url: string
  identity: ReplicaIdentity
  revision: string
  cache?: ReplicaCache
  fetch?(input: string, init: RequestInit): Promise<Response>
  applyAuth?(init: RequestInit): RequestInit
  /** The owning session must discard its ready SQL view on authorization loss. */
  onInvalidated?(error: HttpError): void
}

/** Lazy authenticated transport for one replica generation. Keys never persist. */
export class HttpPayloadLoader {
  #options: HttpPayloadLoaderOptions
  #url: string
  #abort = new AbortController()
  #limit = pLimit(6)
  #pending = new Map<string, Promise<LoadedPayload>>()
  #loaders = new Set<PayloadLoader>()

  constructor(options: HttpPayloadLoaderOptions) {
    const url = new URL(options.url)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new Error('Invalid replica endpoint')
    url.searchParams.set('action', 'replicaPayloads')
    this.#url = url.href
    this.#options = {...options, identity: {...options.identity}}
    if (options.cache && !options.cache.matches(options.identity))
      throw new Error('Payload cache identity mismatch')
  }

  load(requests: ReadonlyArray<PayloadRequest>): Promise<Array<LoadedPayload>> {
    if (this.#abort.signal.aborted)
      return Promise.reject(this.#abort.signal.reason)
    return Promise.all(
      requests.map(request => {
        const key = JSON.stringify([request.versionId, request.payloadId])
        let pending = this.#pending.get(key)
        if (!pending) {
          const captured = {...request}
          pending = this.#limit(() => this.#load(captured)).finally(() =>
            this.#pending.delete(key)
          )
          this.#pending.set(key, pending)
        }
        return pending
      })
    )
  }

  async #load(request: PayloadRequest): Promise<LoadedPayload> {
    const {signal} = this.#abort
    signal.throwIfAborted()
    const {identity, revision, cache, applyAuth} = this.#options
    const body: PayloadBatchRequest = {identity, revision, requests: [request]}
    const init: RequestInit = {
      method: 'POST',
      credentials: 'same-origin',
      headers: {accept: 'application/json', 'content-type': 'application/json'},
      body: JSON.stringify(body)
    }
    const response = await (this.#options.fetch ?? fetch)(this.#url, {
      ...(applyAuth ? applyAuth(init) : init),
      cache: 'no-store',
      redirect: 'error',
      signal
    })
    let consumed = false
    try {
      signal.throwIfAborted()
      if (!response.ok) {
        const error = new HttpError(
          response.status,
          'Payload grant request failed'
        )
        if ([401, 403, 409].includes(response.status)) {
          this.close()
          this.#options.onInvalidated?.(error)
        }
        throw error
      }
      if (
        response.status !== 200 ||
        !response.headers.get('content-type')?.includes('application/json') ||
        !response.body
      )
        throw new Error('Invalid payload response')
      consumed = true
      const bytes = await readBody(
        response.body,
        Math.ceil(payloadBatchLimit / 3) * 4 + 65536,
        signal
      )
      const frames = decodePayloadBatch(
        JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)),
        body
      )
      const loader = new PayloadLoader({
        identity,
        revision,
        cache,
        grants: frames,
        async read() {
          signal.throwIfAborted()
          return frames[0].ciphertext
        }
      })
      // PayloadLoader owns a key copy; clear transport copies immediately.
      for (const frame of frames) frame.key.fill(0)
      this.#loaders.add(loader)
      try {
        signal.throwIfAborted()
        const [payload] = await loader.load([request])
        signal.throwIfAborted()
        return payload
      } finally {
        loader.close()
        this.#loaders.delete(loader)
      }
    } finally {
      if (!consumed) await response.body?.cancel().catch(() => {})
    }
  }

  close(): void {
    this.#abort.abort(new Error('Payload session closed'))
    for (const loader of this.#loaders) loader.close()
    this.#loaders.clear()
  }
}
