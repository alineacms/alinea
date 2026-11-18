import {type MergeFile, mergeFiles} from '@alinea/graft'
import type {Config} from '../Config.js'
import {entryCodec} from './EntryCodec.js'
import {entryFile, type EntryFilesOptions} from './EntryFiles.js'

/**
 * Merges entry files by their records, field by field as the schema's shapes
 * say. Other files take the preferred side, as they do without it.
 */
export function mergeEntryFiles(
  config: Config,
  options: EntryFilesOptions = {}
): MergeFile {
  return mergeFiles({
    codecOf(path) {
      const file = entryFile(config, path, options)
      return file && entryCodec(config.schema, file.format)
    }
  })
}
