import {concatUint8Arrays, sha256Hash} from '#/core/source/Utils.js'

export interface EmbeddingInput {
  mediaType: string
  bytes: Uint8Array
}

export const maxEmbeddingInputBytes = 8 * 1024 * 1024

/** Bind the actual provider input, including its media type, not an external URL. */
export async function prepareEmbeddingInput(
  value: EmbeddingInput
): Promise<{input: EmbeddingInput; hash: string}> {
  if (
    !(value.bytes instanceof Uint8Array) ||
    value.bytes.byteLength > maxEmbeddingInputBytes ||
    typeof value.mediaType !== 'string' ||
    value.mediaType.length > 256 ||
    !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value.mediaType)
  )
    throw new Error('Invalid embedding provider input')
  const input = {
    mediaType: value.mediaType.toLowerCase(),
    bytes: new Uint8Array(value.bytes)
  }
  const header = new TextEncoder().encode(
    JSON.stringify([
      'alinea.embedding-input.v1',
      input.mediaType,
      input.bytes.byteLength
    ]) + '\0'
  )
  return {
    input,
    hash: await sha256Hash(concatUint8Arrays([header, input.bytes]))
  }
}
