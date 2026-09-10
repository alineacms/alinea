import {Blob, Response, crypto} from '@alinea/iso'
import {concatUint8Arrays} from '#/core/source/Utils.js'

export interface FrameIdentity {
  project: string
  namespace: string
  epoch: string
  schemaId: string
  configId: string
  releaseId: string
  versionId: string
  payloadId: string
  kind: 'data' | 'search' | 'references'
}

export interface FrameDescriptor extends FrameIdentity {
  nonce: Uint8Array
  compression: 'none' | 'gzip'
  plaintextLength: number
  ciphertextLength: number
}

export interface FrameBinding extends Omit<
  FrameIdentity,
  'versionId' | 'payloadId' | 'kind'
> {}

export interface FrameGrant {
  descriptor: FrameDescriptor
  key: Uint8Array
}

export interface FrameLimits {
  plaintext: number
  ciphertext: number
}

const defaults: FrameLimits = {
  plaintext: 16 * 1024 * 1024,
  ciphertext: 20 * 1024 * 1024
}

function identityData(identity: FrameIdentity): Array<string> {
  const fields = [
    identity.project,
    identity.namespace,
    identity.epoch,
    identity.schemaId,
    identity.configId,
    identity.releaseId,
    identity.versionId,
    identity.payloadId,
    identity.kind
  ]
  if (fields.some(value => typeof value !== 'string' || !value))
    throw new Error('Incomplete frame identity')
  if (!['data', 'search', 'references'].includes(identity.kind))
    throw new Error('Unknown frame class')
  return fields
}

function additionalData(frame: FrameDescriptor): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    JSON.stringify([
      'alinea.sqlite.frame.v1',
      ...identityData(frame),
      frame.compression,
      frame.plaintextLength,
      frame.ciphertextLength
    ])
  )
}

export function frameIdentityKey(identity: FrameIdentity): string {
  return JSON.stringify(identityData(identity))
}

function size(value: number, maximum: number): void {
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 0 ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximum
  )
    throw new Error('Frame size exceeds decode limits')
}

async function importKey(key: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  if (key.byteLength !== 32) throw new Error('Frame keys must contain 32 bytes')
  return crypto.subtle.importKey('raw', key.slice(), 'AES-GCM', false, [usage])
}

/** Generate independent entry/frame keys on the trusted producer, never from content hashes. */
export function createFrameKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

/** Public output contains no decode key. Only an authenticated read grant carries the key. */
export async function encryptFrame(
  identity: FrameIdentity,
  contents: Uint8Array,
  key: Uint8Array,
  compression: FrameDescriptor['compression'] = 'gzip',
  limits: FrameLimits = defaults
): Promise<{descriptor: FrameDescriptor; ciphertext: Uint8Array}> {
  identity = {...identity}
  limits = {...limits}
  identityData(identity)
  if (compression !== 'none' && compression !== 'gzip')
    throw new Error('Unknown frame compression')
  size(contents.byteLength, limits.plaintext)
  const plaintext = contents.slice()
  const frameKey = await importKey(key, 'encrypt')
  const compressed =
    compression === 'none'
      ? plaintext
      : new Uint8Array(
          await new Response(
            new Blob([plaintext])
              .stream()
              .pipeThrough(new globalThis.CompressionStream('gzip'))
          ).arrayBuffer()
        )
  size(compressed.byteLength + 16, limits.ciphertext)
  const descriptor: FrameDescriptor = {
    project: identity.project,
    namespace: identity.namespace,
    epoch: identity.epoch,
    schemaId: identity.schemaId,
    configId: identity.configId,
    releaseId: identity.releaseId,
    versionId: identity.versionId,
    payloadId: identity.payloadId,
    kind: identity.kind,
    nonce: crypto.getRandomValues(new Uint8Array(12)),
    compression,
    plaintextLength: plaintext.byteLength,
    ciphertextLength: compressed.byteLength + 16
  }
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: descriptor.nonce as BufferSource,
      additionalData: additionalData(descriptor) as BufferSource,
      tagLength: 128
    },
    frameKey,
    compressed
  )
  return {descriptor, ciphertext: new Uint8Array(encrypted)}
}

export function validateFrameDescriptor(
  expected: FrameIdentity,
  frame: FrameDescriptor,
  limits: FrameLimits = defaults
): void {
  if (
    JSON.stringify(identityData(expected)) !==
    JSON.stringify(identityData(frame))
  )
    throw new Error('Frame identity mismatch')
  size(frame.plaintextLength, limits.plaintext)
  size(frame.ciphertextLength, limits.ciphertext)
  if (frame.ciphertextLength < 16) throw new Error('Incomplete encrypted frame')
  if (!(frame.nonce instanceof Uint8Array) || frame.nonce.byteLength !== 12)
    throw new Error('Invalid frame nonce')
  if (frame.compression !== 'none' && frame.compression !== 'gzip')
    throw new Error('Unknown frame compression')
}

/** Check the authenticated handler's expected identity before accepting any frame bytes. */
export async function decryptFrame(
  expected: FrameIdentity,
  descriptor: FrameDescriptor,
  ciphertext: Uint8Array,
  key: Uint8Array,
  limits: FrameLimits = defaults,
  signal?: AbortSignal
): Promise<Uint8Array> {
  signal?.throwIfAborted()
  // Capture mutable caller buffers and descriptor fields before asynchronous work.
  const frame = {...descriptor, nonce: descriptor.nonce.slice()}
  validateFrameDescriptor(expected, frame, limits)
  if (ciphertext.byteLength !== frame.ciphertextLength)
    throw new Error('Incomplete encrypted frame')
  const bytes = ciphertext.slice()
  const frameKey = await importKey(key, 'decrypt')
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: frame.nonce,
      additionalData: additionalData(frame),
      tagLength: 128
    },
    frameKey,
    bytes
  )
  signal?.throwIfAborted()
  if (frame.compression === 'none') {
    if (decrypted.byteLength !== frame.plaintextLength)
      throw new Error('Decoded frame length mismatch')
    return new Uint8Array(decrypted)
  }
  const reader = new Blob([decrypted])
    .stream()
    .pipeThrough(new globalThis.DecompressionStream('gzip'))
    .getReader()
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
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > frame.plaintextLength)
        throw new Error('Decoded frame exceeds declared length')
      chunks.push(chunk.value)
    }
    if (length !== frame.plaintextLength)
      throw new Error('Decoded frame length mismatch')
    return concatUint8Arrays(chunks)
  } finally {
    signal?.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
