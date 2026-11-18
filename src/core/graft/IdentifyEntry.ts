import type {Identify} from '@alinea/graft'
import type {Config} from '../Config.js'
import {isRecord} from '../util/Objects.js'
import {entryCodec} from './EntryCodec.js'
import {entryFile, type EntryFilesOptions} from './EntryFiles.js'

/**
 * The id of the entry version a file holds: translations share the entry's
 * id and each status is a file of its own, so the locale and status read
 * from the path complete it. A merge so follows an entry another save moved.
 */
export function identifyEntry(
  config: Config,
  options: EntryFilesOptions = {}
): Identify {
  return (path, contents) => {
    const file = entryFile(config, path, options)
    if (!file) return undefined
    const id = entryId(config, file.format, contents)
    if (!id) return undefined
    return `${id}:${file.locale ?? ''}:${file.status}`
  }
}

export function entryId(
  config: Config,
  format: Parameters<typeof entryCodec>[1],
  contents: Uint8Array
): string | undefined {
  try {
    const record = entryCodec(config.schema, format).parse(contents)
    if (!isRecord(record)) return undefined
    const id = record._i18nId ?? record._id
    return typeof id === 'string' ? id : undefined
  } catch {
    return undefined
  }
}
