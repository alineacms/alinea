import {sha256Hash} from '#/core/source/Utils.js'
import {canonicalJson} from '#/core/util/Json.js'

export interface EmbeddingSpace {
  provider: string
  model: string
  revision: string
  preprocessing: string
  dimensions: number
  metric: 'cosine' | 'l2' | 'dot'
  encoding: 'float32-le'
}

export interface EmbeddingOwner {
  owner: {versionId: string; kind: 'entry' | 'image' | 'document'}
  /** Current entry payload descriptor, distinct from an image/document source hash. */
  ownerPayloadId: string
  slot: string
  space: EmbeddingSpace
}

export interface EmbeddingTarget extends EmbeddingOwner {
  chunk: string
  sourceHash: string
}

export interface EmbeddingPublication extends EmbeddingOwner {
  chunks: ReadonlyArray<{chunk: string; sourceHash: string}>
}

export interface EmbeddingJob {
  id: string
  generation: string
  spaceId: string
  target: EmbeddingTarget
}

export interface EmbeddingManifest extends EmbeddingJob {
  payloadId: string | null
}

export function validateEmbedding(target: EmbeddingTarget): void {
  validateEmbeddingOwner(target)
  if (
    typeof target.chunk !== 'string' ||
    !target.chunk ||
    target.chunk.length > 1024 ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(target.sourceHash)
  )
    throw new Error('Invalid embedding source')
}

export function validateEmbeddingOwner(target: EmbeddingOwner): void {
  const {owner, space} = target
  for (const value of [owner.versionId, target.ownerPayloadId, target.slot])
    if (typeof value !== 'string' || !value || value.length > 1024)
      throw new Error('Invalid embedding identity')
  if (!['entry', 'image', 'document'].includes(owner.kind))
    throw new Error('Invalid embedding source')
  validateSpace(space)
}

function validateSpace(space: EmbeddingSpace): void {
  for (const value of [
    space.provider,
    space.model,
    space.revision,
    space.preprocessing
  ])
    if (typeof value !== 'string' || !value || value.length > 1024)
      throw new Error('Invalid embedding space identity')
  if (
    !Number.isInteger(space.dimensions) ||
    space.dimensions < 1 ||
    space.dimensions > 65536 ||
    !['cosine', 'l2', 'dot'].includes(space.metric) ||
    space.encoding !== 'float32-le'
  )
    throw new Error('Unsupported embedding space')
}

export function embeddingHash(value: unknown): Promise<string> {
  return sha256Hash(new TextEncoder().encode(canonicalJson(value)))
}

export function encodeEmbedding(
  space: EmbeddingSpace,
  values: ReadonlyArray<number>
): Uint8Array {
  validateSpace(space)
  if (values.length !== space.dimensions)
    throw new Error('Embedding dimension mismatch')
  const bytes = new Uint8Array(values.length * 4)
  const view = new DataView(bytes.buffer)
  let nonzero = false
  for (let i = 0; i < values.length; i++) {
    if (
      typeof values[i] !== 'number' ||
      !Number.isFinite(values[i]) ||
      !Number.isFinite(Math.fround(values[i]))
    )
      throw new Error('Embedding components must be finite float32 values')
    view.setFloat32(i * 4, values[i], true)
    nonzero ||= view.getFloat32(i * 4, true) !== 0
  }
  if (space.metric === 'cosine' && !nonzero)
    throw new Error('Cosine embedding must be nonzero')
  return bytes
}

export function decodeEmbedding(
  space: EmbeddingSpace,
  bytes: Uint8Array
): Array<number> {
  validateSpace(space)
  if (bytes.byteLength !== space.dimensions * 4)
    throw new Error('Embedding byte length mismatch')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const values = Array.from({length: space.dimensions}, (_, i) =>
    view.getFloat32(i * 4, true)
  )
  encodeEmbedding(space, values)
  return values
}
