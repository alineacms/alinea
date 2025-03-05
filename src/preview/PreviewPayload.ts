import {PreviewUpdate} from 'alinea/core/Preview'
import {decode, encode} from 'alinea/core/util/BufferToBase64'
import * as decoding from 'lib0/decoding.js'
import * as encoding from 'lib0/encoding.js'

export function encodePreviewPayload(update: PreviewUpdate): Promise<string> {
  const encoder = encoding.createEncoder()
  encoding.writeVarString(encoder, update.locale ?? '')
  encoding.writeVarString(encoder, update.entryId)
  encoding.writeVarString(encoder, update.contentHash)
  encoding.writeVarString(encoder, update.status)
  encoding.writeVarUint8Array(encoder, update.update)
  return encode(encoding.toUint8Array(encoder))
}

export async function decodePreviewPayload(
  payload: string
): Promise<PreviewUpdate> {
  const decoder = decoding.createDecoder(new Uint8Array(await decode(payload)))
  return {
    locale: decoding.readVarString(decoder) || null,
    entryId: decoding.readVarString(decoder),
    contentHash: decoding.readVarString(decoder),
    status: decoding.readVarString(decoder),
    update: decoding.readVarUint8Array(decoder)
  }
}
