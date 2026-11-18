import {Config} from '../Config.js'
import type {EntryStatus} from '../Entry.js'
import {parseEntryFilePath} from '../util/EntryFilenames.js'
import {type EntryFormat, jsonFormat} from './EntryCodec.js'

/** Where entries are in the trees a merge is given */
export interface EntryFilesOptions {
  /**
   * The directory holding the entries, from the root of the tree,
   * `Config.contentDir` by default. An empty string for a tree of content
   * only.
   */
  contentDir?: string
  /** The formats of entry files, JSON by default */
  formats?: Array<EntryFormat>
}

export interface EntryFile {
  /** The path below the content directory */
  path: string
  format: EntryFormat
  workspace: string
  root: string
  locale: string | null
  status: EntryStatus
  /** Segments of the path taken up by the workspace, root and locale */
  levelOffset: number
}

/** The content directory as a prefix of paths, empty or ending in a slash */
export function contentPrefix(
  config: Config,
  options: EntryFilesOptions = {}
): string {
  const dir = options.contentDir ?? Config.contentDir(config)
  const trimmed = dir.replace(/^\.\/?/, '').replace(/\/$/, '')
  return trimmed === '' ? '' : `${trimmed}/`
}

/** Reads where an entry lives from its path, undefined for other files */
export function entryFile(
  config: Config,
  path: string,
  options: EntryFilesOptions = {}
): EntryFile | undefined {
  const prefix = contentPrefix(config, options)
  if (!path.startsWith(prefix)) return undefined
  const inner = path.slice(prefix.length)
  const formats = options.formats ?? [jsonFormat]
  const format = formats.find(format => inner.endsWith(format.extension))
  if (!format) return undefined
  try {
    const location = parseEntryFilePath(config, inner)
    return {
      path: inner,
      format,
      workspace: location.workspace,
      root: location.root,
      locale: location.locale,
      status: location.versionStatus,
      levelOffset: location.levelOffset
    }
  } catch {
    return undefined
  }
}
