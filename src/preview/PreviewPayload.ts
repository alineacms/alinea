import type {PreviewUpdate} from '#/core/Preview.js'
import {assert} from '#/core/util/Assert.js'
import {
  decode as decodeBase64,
  encode as encodeBase64
} from '#/core/util/BufferToBase64.js'
import {decode, encode} from 'microcbor'

export function encodePreviewPayload(update: PreviewUpdate): Promise<string> {
  return encodeBase64(
    encode([
      update.locale,
      update.entryId,
      update.contentHash,
      update.status,
      update.patch
    ])
  )
}

export async function decodePreviewPayload(
  payload: string
): Promise<PreviewUpdate> {
  const value = decode(new Uint8Array(await decodeBase64(payload)))
  assert(Array.isArray(value), 'Invalid preview payload')
  assert(value.length === 5, 'Invalid preview payload')
  const [locale, entryId, contentHash, status, patch] = value
  assert(
    locale === null || typeof locale === 'string',
    'Invalid preview locale'
  )
  assert(typeof entryId === 'string', 'Invalid preview entry id')
  assert(typeof contentHash === 'string', 'Invalid preview content hash')
  assert(typeof status === 'string', 'Invalid preview status')
  assert(patch instanceof Uint8Array, 'Invalid preview patch')
  return {
    locale,
    entryId,
    contentHash,
    status,
    patch
  }
}
