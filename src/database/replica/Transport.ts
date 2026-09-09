import {fetch, type Response} from '@alinea/iso'
import {concatUint8Arrays} from '#/core/source/Utils.js'
import {
  frameIdentityKey,
  validateFrameDescriptor,
  type FrameDescriptor
} from './Frame.js'

export interface PackedFrame {
  descriptor: FrameDescriptor
  ciphertext: Uint8Array
}

export interface FrameLocation {
  descriptor: FrameDescriptor
  url: string
  offset: number
}

/** Assemble public ciphertext only; descriptors and keys are distributed separately. */
export function packFrames(
  frames: Iterable<PackedFrame>,
  maximumBytes = 64 * 1024 * 1024
) {
  const chunks: Array<Uint8Array> = []
  const locations: Array<{descriptor: FrameDescriptor; offset: number}> = []
  const seen = new Set<string>()
  let length = 0
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0)
    throw new Error('Invalid bundle limit')
  for (const frame of frames) {
    validateFrameDescriptor(frame.descriptor, frame.descriptor)
    const id = frameIdentityKey(frame.descriptor)
    if (seen.has(id)) throw new Error('Duplicate bundle frame')
    seen.add(id)
    if (frame.ciphertext.length !== frame.descriptor.ciphertextLength)
      throw new Error('Incomplete bundle frame')
    if (length + frame.ciphertext.length > maximumBytes)
      throw new Error('Bundle exceeds size limit')
    locations.push({
      descriptor: {...frame.descriptor, nonce: frame.descriptor.nonce.slice()},
      offset: length
    })
    chunks.push(frame.ciphertext.slice())
    length += frame.ciphertext.length
  }
  return {contents: concatUint8Arrays(chunks), locations}
}

export interface RangeFetch {
  (url: URL, init: RequestInit): Promise<Response>
}

export interface RangeOptions {
  fetch?: RangeFetch
  maximumRangeBytes?: number
  /** Explicit bounded fallback for hosts that ignore Range. Disabled by default. */
  maximumFullResponseBytes?: number
}

export class HttpRangeSource {
  #url: URL
  #fetch: RangeFetch
  #rangeLimit: number
  #fullLimit: number

  constructor(url: string, options: RangeOptions = {}) {
    this.#url = new URL(url)
    if (
      !['http:', 'https:'].includes(this.#url.protocol) ||
      this.#url.username ||
      this.#url.password
    )
      throw new Error('Invalid public bundle URL')
    this.#fetch = options.fetch ?? fetch.bind(globalThis)
    this.#rangeLimit = options.maximumRangeBytes ?? 20 * 1024 * 1024
    this.#fullLimit = options.maximumFullResponseBytes ?? 0
    for (const limit of [this.#rangeLimit, this.#fullLimit])
      if (!Number.isSafeInteger(limit) || limit < 0)
        throw new Error('Invalid response limit')
  }

  async read(
    offset: number,
    length: number,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    signal?.throwIfAborted()
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > this.#rangeLimit ||
      !Number.isSafeInteger(offset + length)
    )
      throw new Error('Invalid bundle range')
    if (!length) return new Uint8Array()
    const end = offset + length - 1
    const response = await this.#fetch(this.#url, {
      signal,
      credentials: 'omit',
      redirect: 'error',
      headers: {range: `bytes=${offset}-${end}`}
    })
    let consumed = false
    try {
      const encoding = response.headers.get('content-encoding')
      if (encoding && encoding !== 'identity')
        throw new Error('Encoded bundle ranges are unsupported')
      const full = response.status === 200 && this.#fullLimit > 0
      if (!full && response.status !== 206)
        throw new Error(
          `Bundle server did not honor Range (${response.status})`
        )
      if (!full) {
        const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
          response.headers.get('content-range') ?? ''
        )
        if (
          !match ||
          Number(match[1]) !== offset ||
          Number(match[2]) !== end ||
          !Number.isSafeInteger(Number(match[3])) ||
          Number(match[3]) <= end
        )
          throw new Error('Bundle Content-Range mismatch')
      }
      const maximum = full ? this.#fullLimit : length
      const declared = response.headers.get('content-length')
      if (
        declared !== null &&
        (!/^\d+$/.test(declared) ||
          !Number.isSafeInteger(Number(declared)) ||
          Number(declared) > maximum ||
          (!full && Number(declared) !== length))
      )
        throw new Error('Bundle Content-Length mismatch')
      if (!response.body) throw new Error('Missing bundle response body')
      consumed = true
      const bytes = await readBody(response.body, maximum, signal)
      if (declared !== null && bytes.length !== Number(declared))
        throw new Error('Incomplete bundle response')
      if (full) {
        if (bytes.length < offset + length)
          throw new Error('Incomplete bundle response')
        return bytes.slice(offset, offset + length)
      }
      if (bytes.length !== length) throw new Error('Incomplete bundle response')
      return bytes
    } finally {
      if (!consumed) await response.body?.cancel().catch(() => {})
    }
  }
}

async function readBody(
  body: ReadableStream<Uint8Array>,
  maximum: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Array<Uint8Array> = []
  let length = 0
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => {})
  }
  signal?.addEventListener('abort', abort, {once: true})
  try {
    for (;;) {
      signal?.throwIfAborted()
      const chunk = await reader.read()
      signal?.throwIfAborted()
      if (chunk.done) return concatUint8Arrays(chunks)
      length += chunk.value.length
      if (length > maximum)
        throw new Error('Bundle response exceeds byte limit')
      chunks.push(chunk.value)
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** A scoped manifest reader suitable for PayloadLoaderOptions.read. */
export class HttpFrameReader {
  #locations = new Map<
    string,
    {source: HttpRangeSource; offset: number; length: number}
  >()

  constructor(
    locations: ReadonlyArray<FrameLocation>,
    options: RangeOptions = {}
  ) {
    const sources = new Map<string, HttpRangeSource>()
    for (const location of locations) {
      validateFrameDescriptor(location.descriptor, location.descriptor)
      const id = frameIdentityKey(location.descriptor)
      if (this.#locations.has(id)) throw new Error('Duplicate frame location')
      let source = sources.get(location.url)
      if (!source)
        sources.set(
          location.url,
          (source = new HttpRangeSource(location.url, options))
        )
      this.#locations.set(id, {
        source,
        offset: location.offset,
        length: location.descriptor.ciphertextLength
      })
    }
  }

  read(frame: FrameDescriptor, signal?: AbortSignal): Promise<Uint8Array> {
    const location = this.#locations.get(frameIdentityKey(frame))
    if (!location || location.length !== frame.ciphertextLength)
      return Promise.reject(new Error('Missing frame location'))
    return location.source.read(location.offset, location.length, signal)
  }
}
