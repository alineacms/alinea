import type {EntryRecord} from '#/core/EntryRecord.js'
import type {PreviewDelta, PreviewUpdate} from '#/core/Preview.js'
import {assert} from '#/core/util/Assert.js'
import {
  decode as decodeBase64,
  encode as encodeBase64
} from '#/core/util/BufferToBase64.js'
import {isRecord} from '#/core/util/Objects.js'
import {decode, encode} from 'microcbor'

export function encodePreviewPayload(
  update: PreviewUpdate | PreviewDelta
): Promise<string> {
  if ('version' in update)
    return encodeBase64(
      encode([
        update.version,
        update.locale,
        update.entryId,
        update.contentHash,
        update.status,
        update.fileHash,
        update.delta,
        update.record ? JSON.stringify(update.record) : null
      ])
    )
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
): Promise<PreviewUpdate | PreviewDelta> {
  const value = decode(new Uint8Array(await decodeBase64(payload)))
  assert(Array.isArray(value), 'Invalid preview payload')
  if (value[0] === 2) return decodeDelta(value)
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

function decodeDelta(value: Array<unknown>): PreviewDelta {
  assert(value.length === 8, 'Invalid preview payload')
  const [, locale, entryId, contentHash, status, fileHash, delta, record] =
    value
  assert(
    locale === null || typeof locale === 'string',
    'Invalid preview locale'
  )
  assert(typeof entryId === 'string', 'Invalid preview entry id')
  assert(typeof contentHash === 'string', 'Invalid preview content hash')
  assert(typeof status === 'string', 'Invalid preview status')
  assert(typeof fileHash === 'string', 'Invalid preview file hash')
  assert(delta instanceof Uint8Array, 'Invalid preview delta')
  assert(
    record === null || typeof record === 'string',
    'Invalid preview record'
  )
  const parsed = record === null ? undefined : JSON.parse(record)
  assert(parsed === undefined || isRecord(parsed), 'Invalid preview record')
  return {
    version: 2,
    locale,
    entryId,
    contentHash,
    status,
    fileHash,
    delta,
    record: parsed as EntryRecord | undefined
  }
}
