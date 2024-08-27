import {PreviewUpdate} from 'alinea/core/Resolver'
import {decode, encode} from 'buffer-to-base64'
import * as decoding from 'lib0/decoding.js'
import * as encoding from 'lib0/encoding.js'

export function encodePreviewPayload(update: PreviewUpdate): Promise<string> {
  const encoder = encoding.createEncoder()
  encoding.writeVarString(encoder, update.entryId)
  encoding.writeVarString(encoder, update.contentHash)
  encoding.writeVarString(encoder, update.phase)
  encoding.writeVarUint8Array(encoder, update.update)
  return encode(encoding.toUint8Array(encoder))
}

export async function decodePreviewPayload(
  payload: string
): Promise<PreviewUpdate> {
  const decoder = decoding.createDecoder(new Uint8Array(await decode(payload)))
  return {
    entryId: decoding.readVarString(decoder),
    contentHash: decoding.readVarString(decoder),
    phase: decoding.readVarString(decoder),
    update: decoding.readVarUint8Array(decoder)
  }
}
