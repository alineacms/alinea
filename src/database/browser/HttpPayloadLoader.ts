import {HttpError} from '#/core/HttpError.js'
import {
  payloadRequestLimit,
  type PayloadBatchRequest
} from '../replica/PayloadBatch.js'
import type {
  PayloadRequest,
  SerializedPayload
} from '../runtime/EntryRuntime.js'
import {decodePayloadStream} from './DecodePayloadBatch.js'
import type {ReplicaCache, ReplicaIdentity} from './ReplicaCache.js'

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

interface QueuedPayload {
  request: PayloadRequest
  resolve(payload: SerializedPayload): void
  reject(error: unknown): void
}

/** Coalesced, streaming authenticated transport for exact entry payloads. */
export class HttpPayloadLoader {
  #options: HttpPayloadLoaderOptions
  #url: string
  #abort = new AbortController()
  #pending = new Map<string, Promise<SerializedPayload>>()
  #queued = new Map<string, QueuedPayload>()
  #scheduled = false
  #cacheWrites: Promise<void> = Promise.resolve()
  #cacheQueue: Array<() => Promise<void>> = []
  #cacheTimer?: ReturnType<typeof setTimeout>

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

  async load(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<Array<SerializedPayload>> {
    this.#abort.signal.throwIfAborted()
    const cached = await this.#options.cache?.getPayloads(requests)
    this.#abort.signal.throwIfAborted()
    const byVersion = new Map(cached?.map(row => [row.versionId, row]))
    return Promise.all(
      requests.map(
        request => byVersion.get(request.versionId) ?? this.#request(request)
      )
    )
  }

  #request(request: PayloadRequest): Promise<SerializedPayload> {
    const key = JSON.stringify([request.versionId, request.payloadId])
    const existing = this.#pending.get(key)
    if (existing) return existing
    const task = new Promise<SerializedPayload>((resolve, reject) => {
      this.#queued.set(key, {request: {...request}, resolve, reject})
    })
    const pending = task.finally(() => this.#pending.delete(key))
    this.#pending.set(key, pending)
    if (!this.#scheduled) {
      this.#scheduled = true
      setTimeout(() => void this.#flush(), 0)
    }
    return pending
  }

  async #flush(): Promise<void> {
    this.#scheduled = false
    const queued = [...this.#queued.entries()].slice(0, payloadRequestLimit)
    for (const [key] of queued) this.#queued.delete(key)
    if (this.#queued.size && !this.#scheduled) {
      this.#scheduled = true
      setTimeout(() => void this.#flush(), 0)
    }
    if (!queued.length) return
    try {
      const payloads = await this.#fetchBatch(
        queued.map(([, item]) => item.request)
      )
      const found = new Map(payloads.map(row => [row.versionId, row]))
      for (const [, item] of queued) {
        const payload = found.get(item.request.versionId)
        if (!payload) throw new Error('Incomplete payload response')
        item.resolve(payload)
      }
    } catch (error) {
      for (const [, item] of queued) item.reject(error)
    }
  }

  async #fetchBatch(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<Array<SerializedPayload>> {
    const {signal} = this.#abort
    signal.throwIfAborted()
    const {identity, revision, cache, applyAuth} = this.#options
    const body: PayloadBatchRequest = {
      identity,
      revision,
      requests: [...requests]
    }
    const init: RequestInit = {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        accept: 'application/x-alinea-payloads, application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    }
    const response = await (this.#options.fetch ?? fetch)(this.#url, {
      ...(applyAuth ? applyAuth(init) : init),
      cache: 'no-store',
      redirect: 'error',
      signal
    })
    signal.throwIfAborted()
    if (response.status === 413 && requests.length > 1) {
      await response.body?.cancel().catch(() => {})
      const middle = Math.ceil(requests.length / 2)
      const [left, right] = await Promise.all([
        this.#fetchBatch(requests.slice(0, middle)),
        this.#fetchBatch(requests.slice(middle))
      ])
      return [...left, ...right]
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      const error = new HttpError(response.status, 'Payload request failed')
      if ([401, 403, 409].includes(response.status)) {
        this.close()
        this.#options.onInvalidated?.(error)
      }
      throw error
    }
    if (
      response.status !== 200 ||
      !response.headers
        .get('content-type')
        ?.includes('application/x-alinea-payloads') ||
      !response.body
    ) {
      await response.body?.cancel().catch(() => {})
      throw new Error('Invalid payload response')
    }
    const buffered: Array<SerializedPayload> = []
    const flushCache = () => {
      if (!cache || !buffered.length) return
      const chunk = buffered.splice(0)
      this.#cacheQueue.push(() => cache.putPayloads(revision, chunk))
      if (this.#cacheTimer) clearTimeout(this.#cacheTimer)
      this.#cacheTimer = setTimeout(() => this.#drainCache(), 30_000)
    }
    const payloads = await decodePayloadStream(response.body, body, row => {
      buffered.push(row)
      if (buffered.length >= 1000) flushCache()
    })
    flushCache()
    signal.throwIfAborted()
    return payloads
  }

  /** Wait for optional persistence without putting it on query readiness. */
  flushCache(): Promise<void> {
    this.#drainCache()
    return this.#cacheWrites
  }

  #drainCache(): void {
    if (this.#cacheTimer) clearTimeout(this.#cacheTimer)
    this.#cacheTimer = undefined
    const queued = this.#cacheQueue.splice(0)
    for (const write of queued)
      this.#cacheWrites = this.#cacheWrites.then(write).catch(() => {})
  }

  close(): void {
    const error = new Error('Payload session closed')
    this.#abort.abort(error)
    for (const item of this.#queued.values()) item.reject(error)
    this.#queued.clear()
  }
}
