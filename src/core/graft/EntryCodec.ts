import {type Codec, jsonCodec, type Shape} from '@alinea/graft'
import {Schema} from '../Schema.js'

/**
 * A file format for entries. Its codec reads a file to the record it holds
 * and writes a merged record back, like the file it had. A format that
 * derives values from positions, such as ids of rows written without them,
 * reads without deriving them, so the merge matches what the file holds.
 */
export interface EntryFormat {
  extension: string
  codec(shape: Shape): Codec
}

/** Entries as alinea writes them: JSON indented by two spaces */
export const jsonFormat: EntryFormat = {
  extension: '.json',
  codec: jsonCodec
}

const codecs = new WeakMap<Schema, Map<EntryFormat, Codec>>()

/** How entry files of a schema are read, merged and written */
export function entryCodec(
  schema: Schema,
  format: EntryFormat = jsonFormat
): Codec {
  let known = codecs.get(schema)
  if (!known) codecs.set(schema, (known = new Map()))
  let codec = known.get(format)
  if (!codec) known.set(format, (codec = format.codec(Schema.shape(schema))))
  return codec
}
