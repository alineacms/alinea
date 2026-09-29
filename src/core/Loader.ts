import type {Config} from './Config.js'
import type {EntryRecord} from './EntryRecord.js'
import type {Schema} from './Schema.js'
import {extname} from './util/Paths.js'
import {JsonLoader} from './loader/JsonLoader.js'
import {YamlLoader} from './loader/YamlLoader.js'

export interface Loader {
  extension: string
  parse(schema: Schema, input: Uint8Array): EntryRecord
  format(schema: Schema, entry: EntryRecord): Uint8Array
}

/** Every content file format, recognized by its file extension. */
export const contentLoaders: ReadonlyArray<Loader> = [JsonLoader, YamlLoader]

/** The loader new entry files are written with, set by `contentFormat`. */
export function defaultLoader(config: Config): Loader {
  const format = config.contentFormat ?? 'json'
  const loader = contentLoaders.find(
    loader => loader.extension === `.${format}`
  )
  if (!loader)
    throw new Error(
      `Unknown contentFormat "${format}" in the Alinea config, expected ${contentLoaders
        .map(loader => loader.extension.slice(1))
        .join(' or ')}`
    )
  return loader
}

/** Whether a loader reads the file, other files (.DS_Store) are ignored. */
export function isContentFile(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase()
  return contentLoaders.some(loader => loader.extension === extension)
}

/** The loader that reads and writes the content file at `filePath`. */
export function loaderFor(filePath: string): Loader {
  const extension = extname(filePath).toLowerCase()
  const loader = contentLoaders.find(loader => loader.extension === extension)
  if (!loader)
    throw new Error(
      `Unsupported content file ${filePath}, expected one of: ${contentLoaders
        .map(loader => loader.extension)
        .join(', ')}`
    )
  return loader
}
