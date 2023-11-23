import {Schema} from 'alinea/core'
import {EntryRecord, META_KEY} from 'alinea/core/EntryRecord'
import {Loader} from '../Loader.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const JsonLoader: Loader = {
  extension: '.json',
  parse(schema: Schema, input: Uint8Array) {
    const raw = JSON.parse(decoder.decode(input))
    // This is backwards compatibility for the old format
    if (!raw[META_KEY]) raw[META_KEY] = raw.alinea ?? {}
    if (!raw[META_KEY].entryId)
      raw[META_KEY].entryId = raw.id ?? raw[META_KEY].id
    if (!raw[META_KEY].type) raw[META_KEY].type = raw.type
    if (!raw[META_KEY].i18nId && raw[META_KEY].i18n)
      raw[META_KEY].i18nId = raw[META_KEY].i18n?.id
    return raw as EntryRecord
  },
  format(schema: Schema, entry: EntryRecord) {
    return encoder.encode(JSON.stringify(entry, null, '  '))
  }
}
