import {isRecord} from '#/core/util/Objects.js'
import pLimit from 'p-limit'
import {
  decryptFrame,
  validateFrameDescriptor,
  type FrameDescriptor,
  type FrameLimits,
  type FrameGrant
} from '../replica/Frame.js'
import {
  validateSource,
  type PayloadRequest,
  type LoadedPayload
} from '../runtime/EntryRuntime.js'
import type {ReplicaCache, ReplicaIdentity} from './ReplicaCache.js'

export interface PayloadLoaderOptions {
  identity: ReplicaIdentity
  revision: string
  grants: ReadonlyArray<FrameGrant>
  cache?: ReplicaCache
  limits?: FrameLimits
  /** Transport must bound reads to the descriptor's exact ciphertext length. */
  read(frame: FrameDescriptor, signal: AbortSignal): Promise<Uint8Array>
}

/** One authenticated replica generation's grants; keys and plaintext stay in memory. */
export class PayloadLoader {
  #options: PayloadLoaderOptions
  #grants = new Map<string, FrameGrant>()
  #pending = new Map<string, Promise<LoadedPayload>>()
  #abort = new AbortController()
  #limit = pLimit(6)

  constructor(options: PayloadLoaderOptions) {
    if (options.cache && !options.cache.matches(options.identity))
      throw new Error('Payload cache identity mismatch')
    this.#options = {
      ...options,
      identity: {...options.identity},
      grants: [],
      limits: options.limits && {...options.limits}
    }
    for (const grant of options.grants) {
      validateFrameDescriptor(
        {
          ...options.identity,
          versionId: grant.descriptor.versionId,
          payloadId: grant.descriptor.payloadId,
          kind: 'data'
        },
        grant.descriptor,
        options.limits
      )
      if (grant.key.byteLength !== 32)
        throw new Error('Frame keys must contain 32 bytes')
      if (grant.descriptor.kind !== 'data')
        throw new Error('Entry loader requires data frames')
      if (this.#grants.has(grant.descriptor.versionId))
        throw new Error('Duplicate entry payload grant')
      this.#grants.set(grant.descriptor.versionId, {
        descriptor: {
          ...grant.descriptor,
          nonce: grant.descriptor.nonce.slice()
        },
        key: grant.key.slice()
      })
    }
  }

  async load(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<Array<LoadedPayload>> {
    this.#abort.signal.throwIfAborted()
    const grants = requests.map(request => {
      const grant = this.#grants.get(request.versionId)
      if (grant?.descriptor.payloadId !== request.payloadId)
        throw new Error('Missing entry payload grant')
      return grant
    })
    return Promise.all(
      grants.map(grant => {
        const {versionId} = grant.descriptor
        let pending = this.#pending.get(versionId)
        if (!pending) {
          pending = this.#limit(() => this.#load(grant)).finally(() =>
            this.#pending.delete(versionId)
          )
          this.#pending.set(versionId, pending)
        }
        return pending
      })
    )
  }

  async #load(grant: FrameGrant): Promise<LoadedPayload> {
    const {descriptor, key} = grant
    const {identity, cache, revision, read, limits} = this.#options
    const {signal} = this.#abort
    signal.throwIfAborted()
    const request = {
      versionId: descriptor.versionId,
      payloadId: descriptor.payloadId
    }
    const expected = {...identity, ...request, kind: 'data' as const}
    const cached = (await cache?.getFrames([request]))?.[0]
    signal.throwIfAborted()
    let decoded: Uint8Array | undefined
    let fetched: Uint8Array | undefined
    if (cached) {
      try {
        decoded = await decryptFrame(
          expected,
          descriptor,
          cached.ciphertext,
          key,
          limits,
          signal
        )
      } catch {
        signal.throwIfAborted()
      }
    }
    if (!decoded) {
      const ciphertext = (
        await read({...descriptor, nonce: descriptor.nonce.slice()}, signal)
      ).slice()
      signal.throwIfAborted()
      decoded = await decryptFrame(
        expected,
        descriptor,
        ciphertext,
        key,
        limits,
        signal
      )
      signal.throwIfAborted()
      fetched = ciphertext
    }
    signal.throwIfAborted()
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', {fatal: true}).decode(decoded)
    )
    if (!isRecord(value) || !isRecord(value.data))
      throw new Error('Invalid entry payload')
    const payload = {
      ...request,
      data: value.data,
      source: validateSource(value.source)
    }
    if (fetched)
      await cache?.putFrames(
        revision,
        [{...request, ciphertext: fetched}],
        signal
      )
    signal.throwIfAborted()
    return payload
  }

  close(): void {
    this.#abort.abort(new Error('Payload grants revoked'))
    for (const grant of this.#grants.values()) grant.key.fill(0)
    this.#grants.clear()
    this.#pending.clear()
  }
}
