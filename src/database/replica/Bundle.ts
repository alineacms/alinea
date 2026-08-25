import {
  Blob,
  CompressionStream,
  crypto,
  DecompressionStream,
  Response
} from '@alinea/iso'
import {bytesToHex} from '#/core/source/Utils.js'
import type {
  AccessClassGrant,
  AccessClassId,
  BundleId,
  FrameCompression,
  FrameDescriptor,
  FrameId
} from './Types.js'

const encoder = new TextEncoder()

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
  cipherHash: string
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

export interface CiphertextCache {
  get(
    bundleId: BundleId,
    frame: FrameDescriptor
  ): Promise<Uint8Array | undefined>
  put(
    bundleId: BundleId,
    frame: FrameDescriptor,
    ciphertext: Uint8Array
  ): Promise<void>
  delete(bundleId: BundleId, frame: FrameDescriptor): Promise<void>
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
  const key = await deriveFrameKey(options.key, options.bundleId, options.id, [
    'encrypt'
  ])
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
    cipherHash: await sha256(ciphertext),
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
      cipherHash: frame.cipherHash,
      compression: frame.compression
    })
    offset += frame.ciphertext.length
  }
  return {contents, frames: descriptors}
}

export class BundleFrameLoader implements FrameLoader {
  #bundleId: BundleId
  #source: ByteRangeSource
  #cache?: CiphertextCache
  #grants = new Map<AccessClassId, Uint8Array>()

  constructor(
    bundleId: BundleId,
    source: ByteRangeSource,
    grants: Iterable<AccessClassGrant>,
    cache?: CiphertextCache
  ) {
    this.#bundleId = bundleId
    this.#source = source
    this.#cache = cache
    for (const grant of grants) {
      this.#grants.set(grant.accessClassId, grant.key.slice())
    }
  }

  async load(
    frame: FrameDescriptor,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const classKey = this.#grants.get(frame.accessClassId)
    if (!classKey) throw new MissingFrameGrantError(frame.accessClassId)
    let ciphertext = await this.#cache?.get(this.#bundleId, frame)
    if (!ciphertext) {
      ciphertext = await this.#source.read(frame.offset, frame.length, signal)
      if (ciphertext.length === frame.length)
        await this.#cache?.put(this.#bundleId, frame, ciphertext)
    }
    if (ciphertext.length !== frame.length)
      throw new BundleIntegrityError(`Incomplete frame "${frame.id}"`)
    const actualHash = await sha256(ciphertext)
    if (actualHash !== frame.cipherHash) {
      await this.#cache?.delete(this.#bundleId, frame)
      throw new BundleIntegrityError(`Invalid hash for frame "${frame.id}"`)
    }
    const key = await deriveFrameKey(classKey, this.#bundleId, frame.id, [
      'decrypt'
    ])
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
}

/** Resolves static base and handler overlay frames from one logical catalog. */
export class CatalogFrameLoader implements FrameLoader {
  #catalogBundleId: BundleId
  #catalogBundleUrl: string
  #source: ByteRangeSourceFactory
  #grants: ReadonlyArray<AccessClassGrant>
  #cache?: CiphertextCache
  #loaders = new Map<string, BundleFrameLoader>()

  constructor(
    bundleId: BundleId,
    bundleUrl: string,
    source: ByteRangeSourceFactory,
    grants: ReadonlyArray<AccessClassGrant>,
    cache?: CiphertextCache
  ) {
    this.#catalogBundleId = bundleId
    this.#catalogBundleUrl = bundleUrl
    this.#source = source
    this.#grants = grants
    this.#cache = cache
  }

  load(frame: FrameDescriptor, signal?: AbortSignal): Promise<Uint8Array> {
    const bundleId = frame.bundleId ?? this.#catalogBundleId
    const bundleUrl = frame.bundleUrl ?? this.#catalogBundleUrl
    const key = `${bundleId}\0${bundleUrl}`
    let loader = this.#loaders.get(key)
    if (!loader) {
      loader = new BundleFrameLoader(
        bundleId,
        this.#source(bundleUrl),
        this.#grants,
        this.#cache
      )
      this.#loaders.set(key, loader)
    }
    return loader.load(frame, signal)
  }
}

export class CachedFrameLoader implements FrameLoader {
  #source: FrameLoader
  #cache = new Map<string, Promise<Uint8Array>>()

  constructor(source: FrameLoader) {
    this.#source = source
  }

  load(frame: FrameDescriptor, signal?: AbortSignal): Promise<Uint8Array> {
    signal?.throwIfAborted()
    const key = `${frame.id}:${frame.cipherHash}`
    let pending = this.#cache.get(key)
    if (!pending) {
      pending = this.#source.load(frame).catch(error => {
        this.#cache.delete(key)
        throw error
      })
      this.#cache.set(key, pending)
    }
    return signal ? abortable(pending, signal) : pending
  }
}

async function deriveFrameKey(
  classKey: Uint8Array,
  bundleId: BundleId,
  frameId: FrameId,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    classKey as BufferSource,
    'HKDF',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(`alinea-replica:${bundleId}`) as BufferSource,
      info: encoder.encode(`frame:${frameId}`) as BufferSource
    },
    material,
    {name: 'AES-GCM', length: 256},
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

async function sha256(contents: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', contents as BufferSource)
  return bytesToHex(new Uint8Array(digest))
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

function abortable<Value>(
  promise: Promise<Value>,
  signal: AbortSignal
): Promise<Value> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, {once: true})
    promise.then(
      value => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', abort)
        reject(error)
      }
    )
  })
}
