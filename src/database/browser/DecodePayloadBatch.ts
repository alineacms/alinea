import {isRecord} from '#/core/util/Objects.js'
import {base64} from '#/core/util/Encoding.js'
import {
  validateFrameDescriptor,
  type FrameDescriptor,
  type FrameGrant
} from '../replica/Frame.js'
import {
  payloadBatchLimit,
  type PayloadBatchRequest
} from '../replica/PayloadBatch.js'

export interface DecodedFrame extends FrameGrant {
  ciphertext: Uint8Array
}

/** Validate the complete envelope before a caller may hydrate or persist any row. */
export function decodePayloadBatch(
  value: unknown,
  expected: PayloadBatchRequest
): Array<DecodedFrame> {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.revision !== expected.revision ||
    !isRecord(value.identity) ||
    !Array.isArray(value.frames) ||
    value.frames.length !== expected.requests.length
  )
    throw new Error('Invalid payload response')
  const identity = value.identity
  for (const key of [
    'project',
    'namespace',
    'epoch',
    'schemaId',
    'configId',
    'releaseId',
    'principal',
    'viewId'
  ] as const)
    if (!expected.identity[key] || identity[key] !== expected.identity[key])
      throw new Error('Payload response identity mismatch')
  const requests = new Map(
    expected.requests.map(request => [request.versionId, request.payloadId])
  )
  if (requests.size !== expected.requests.length || requests.size > 100)
    throw new Error('Invalid payload request batch')
  const result: Array<DecodedFrame> = []
  let size = 0
  try {
    for (const encoded of value.frames) {
      if (!isRecord(encoded) || !isRecord(encoded.descriptor))
        throw new Error('Invalid payload frame')
      const wire = encoded.descriptor
      if (
        typeof wire.versionId !== 'string' ||
        typeof wire.payloadId !== 'string' ||
        !requests.has(wire.versionId) ||
        requests.get(wire.versionId) !== wire.payloadId
      )
        throw new Error('Unexpected payload frame')
      requests.delete(wire.versionId)
      // Explicit projection prevents extra wire properties from entering the runtime.
      const descriptor = {
        project: wire.project,
        namespace: wire.namespace,
        epoch: wire.epoch,
        schemaId: wire.schemaId,
        configId: wire.configId,
        releaseId: wire.releaseId,
        versionId: wire.versionId,
        payloadId: wire.payloadId,
        kind: wire.kind,
        compression: wire.compression,
        plaintextLength: wire.plaintextLength,
        ciphertextLength: wire.ciphertextLength,
        nonce: decodeBytes(wire.nonce, 12)
      } as FrameDescriptor
      validateFrameDescriptor(
        {
          ...expected.identity,
          versionId: wire.versionId,
          payloadId: wire.payloadId,
          kind: 'data'
        },
        descriptor
      )
      size += descriptor.ciphertextLength
      if (size > payloadBatchLimit)
        throw new Error('Payload batch exceeds byte limit')
      const ciphertext = decodeBytes(
        encoded.ciphertext,
        descriptor.ciphertextLength
      )
      const key = decodeBytes(encoded.key, 32)
      result.push({descriptor, ciphertext, key})
    }
    return result
  } catch (error) {
    for (const frame of result) frame.key.fill(0)
    throw error
  }
}

function decodeBytes(value: unknown, length: number): Uint8Array {
  if (typeof value !== 'string' || value.length !== Math.ceil(length / 3) * 4)
    throw new Error('Invalid encoded frame length')
  const bytes = base64.parse(value)
  if (bytes.byteLength !== length)
    throw new Error('Invalid decoded frame length')
  return bytes
}
