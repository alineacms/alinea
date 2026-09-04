import {
  Blob,
  CompressionStream,
  crypto,
  DecompressionStream,
  Response
} from '@alinea/iso'
import type {
  AccessClassGrant,
  AccessClassId,
  BundleId,
  FrameCompression,
  FrameDescriptor,
  FrameId
} from './Types.js'
import pLimit from 'p-limit'

const encoder = new TextEncoder()
const encryptionKeys = new WeakMap<Uint8Array, Promise<CryptoKey>>()

export interface EncryptFrameOptions {
  bundleId: BundleId
  id: FrameId
  accessClassId: AccessClassId
  key: Uint8Array
  contents: Uint8Array
  compression?: FrameCompression
}

export interface EncryptedFrame {
  id: FrameId
  accessClassId: AccessClassId
  nonce: Uint8Array
  compression: FrameCompression
  ciphertext: Uint8Array
}

export interface PackedBundle {
  contents: Uint8Array
  frames: ReadonlyArray<FrameDescriptor>
}

export interface ByteRangeSource {
  read(
    offset: number,
    length: number,
    signal?: AbortSignal
  ): Promise<Uint8Array>
}

export interface FrameLoader {
  load(frame: FrameDescriptor, signal?: AbortSignal): Promise<Uint8Array>
}

export interface ByteRangeSourceFactory {
  (url: string): ByteRangeSource
}

export class MissingFrameGrantError extends Error {
  constructor(accessClassId: AccessClassId) {
    super(`Missing grant for access class "${accessClassId}"`)
  }
}

export class BundleIntegrityError extends Error {}

export class MemoryRangeSource implements ByteRangeSource {
  #contents: Uint8Array

  constructor(contents: Uint8Array) {
    this.#contents = contents
  }

  async read(
    offset: number,
    length: number,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    signal?.throwIfAborted()
    return this.#contents.slice(offset, offset + length)
  }
}

export async function encryptFrame(
  options: EncryptFrameOptions
): Promise<EncryptedFrame> {
  const compression = options.compression ?? 'gzip'
  const compressed = await compress(options.contents, compression)
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  let imported = encryptionKeys.get(options.key)
  if (!imported) {
    imported = importFrameKey(options.key, ['encrypt'])
    encryptionKeys.set(options.key, imported)
  }
  const key = await imported
  const additionalData = frameAdditionalData(
    options.bundleId,
    options.id,
    options.accessClassId,
    compression
  )
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce as BufferSource,
      additionalData: additionalData as BufferSource
    },
    key,
    compressed as BufferSource
  )
  const ciphertext = new Uint8Array(encrypted)
  return {
    id: options.id,
    accessClassId: options.accessClassId,
    nonce,
    compression,
    ciphertext
  }
}

export function packEncryptedFrames(
  frames: Iterable<EncryptedFrame>
): PackedBundle {
  const source = Array.from(frames)
  const ids = new Set<string>()
  const length = source.reduce((total, frame) => {
    if (ids.has(frame.id)) throw new Error(`Duplicate frame "${frame.id}"`)
    ids.add(frame.id)
    return total + frame.ciphertext.length
  }, 0)
  const contents = new Uint8Array(length)
  const descriptors: Array<FrameDescriptor> = []
  let offset = 0
  for (const frame of source) {
    contents.set(frame.ciphertext, offset)
    descriptors.push({
      id: frame.id,
      accessClassId: frame.accessClassId,
      offset,
      length: frame.ciphertext.length,
      nonce: frame.nonce.slice(),
      compression: frame.compression
    })
    offset += frame.ciphertext.length
  }
  return {contents, frames: descriptors}
}

export class BundleFrameLoader implements FrameLoader {
  #bundleId: BundleId
  #source: ByteRangeSource
  #keys = new Map<AccessClassId, Promise<CryptoKey>>()

  constructor(
    bundleId: BundleId,
    source: ByteRangeSource,
    grants: Iterable<AccessClassGrant>
  ) {
    this.#bundleId = bundleId
    this.#source = source
    for (const grant of grants) this.grant(grant.accessClassId, grant.key)
  }

  grant(accessClassId: AccessClassId, key: Uint8Array): void {
    if (!this.#keys.has(accessClassId))
      this.#keys.set(accessClassId, importFrameKey(key, ['decrypt']))
  }

  retainGrants(accessClassIds: ReadonlySet<AccessClassId>): void {
    for (const accessClassId of this.#keys.keys())
      if (!accessClassIds.has(accessClassId)) this.#keys.delete(accessClassId)
  }

  async load(
    frame: FrameDescriptor,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const key = this.#key(frame.accessClassId)
    const ciphertext = await this.#source.read(
      frame.offset,
      frame.length,
      signal
    )
    return this.#decrypt(frame, ciphertext, key)
  }

  async loadMany(
    frames: ReadonlyArray<FrameDescriptor>,
    signal?: AbortSignal
  ): Promise<ReadonlyMap<FrameId, Uint8Array>> {
    signal?.throwIfAborted()
    const keys = new Map(
      frames.map(frame => [frame.id, this.#key(frame.accessClassId)] as const)
    )
    const ciphertext = new Map<FrameId, Uint8Array>()
    const missing: Array<FrameDescriptor> = []
    missing.push(...frames)
    missing.sort((left, right) => left.offset - right.offset)
    const readLimit = pLimit(6)
    await Promise.all(
      mergeFrameRanges(missing).map(range =>
        readLimit(async () => {
          const contents = await this.#source.read(
            range.offset,
            range.length,
            signal
          )
          if (contents.length !== range.length)
            throw new BundleIntegrityError('Incomplete bundle range')
          for (const frame of range.frames) {
            const start = frame.offset - range.offset
            const value = contents.slice(start, start + frame.length)
            ciphertext.set(frame.id, value)
          }
        })
      )
    )
    const limit = pLimit(32)
    return new Map(
      await Promise.all(
        frames.map(frame =>
          limit(async () => {
            const value = ciphertext.get(frame.id)
            if (!value)
              throw new BundleIntegrityError(`Missing frame "${frame.id}"`)
            return [
              frame.id,
              await this.#decrypt(frame, value, keys.get(frame.id)!)
            ] as const
          })
        )
      )
    )
  }

  async #decrypt(
    frame: FrameDescriptor,
    ciphertext: Uint8Array,
    pendingKey: Promise<CryptoKey>
  ): Promise<Uint8Array> {
    if (ciphertext.length !== frame.length)
      throw new BundleIntegrityError(`Incomplete frame "${frame.id}"`)
    const key = await pendingKey
    const additionalData = frameAdditionalData(
      this.#bundleId,
      frame.id,
      frame.accessClassId,
      frame.compression
    )
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: frame.nonce as BufferSource,
        additionalData: additionalData as BufferSource
      },
      key,
      ciphertext as BufferSource
    )
    return decompress(new Uint8Array(decrypted), frame.compression)
  }

  #key(accessClassId: AccessClassId): Promise<CryptoKey> {
    const key = this.#keys.get(accessClassId)
    if (!key) throw new MissingFrameGrantError(accessClassId)
    return key
  }
}

interface FrameRange {
  offset: number
  length: number
  frames: Array<FrameDescriptor>
}

function mergeFrameRanges(
  frames: ReadonlyArray<FrameDescriptor>,
  maximumGap = 16 * 1024
): Array<FrameRange> {
  const ranges: Array<FrameRange> = []
  for (const frame of frames) {
    const previous = ranges.at(-1)
    const previousEnd = previous ? previous.offset + previous.length : undefined
    if (
      previous &&
      previousEnd !== undefined &&
      frame.offset <= previousEnd + maximumGap
    ) {
      previous.length =
        Math.max(previousEnd, frame.offset + frame.length) - previous.offset
      previous.frames.push(frame)
    } else {
      ranges.push({offset: frame.offset, length: frame.length, frames: [frame]})
    }
  }
  return ranges
}

function importFrameKey(
  key: Uint8Array,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    'AES-GCM',
    false,
    usages
  )
}

function frameAdditionalData(
  bundleId: BundleId,
  frameId: FrameId,
  accessClassId: AccessClassId,
  compression: FrameCompression
): Uint8Array {
  return encoder.encode(
    `alinea-replica-frame\0${bundleId}\0${frameId}\0${accessClassId}\0${compression}`
  )
}

async function compress(
  contents: Uint8Array,
  compression: FrameCompression
): Promise<Uint8Array> {
  if (compression === 'none') return contents
  const stream = new Blob([contents as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream(compression))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decompress(
  contents: Uint8Array,
  compression: FrameCompression
): Promise<Uint8Array> {
  if (compression === 'none') return contents
  const stream = new Blob([contents as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream(compression))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
