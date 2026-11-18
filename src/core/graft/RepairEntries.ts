import {
  type Change,
  type Json,
  listDir,
  merge,
  type ObjectStore,
  readFile,
  type Repair,
  type RepairInput
} from '@alinea/graft'
import {dequal} from 'dequal'
import type {Config} from '../Config.js'
import type {Schema} from '../Schema.js'
import {ALT_STATUS} from '../Entry.js'
import {Field} from '../Field.js'
import {Type} from '../Type.js'
import {entries, isRecord} from '../util/Objects.js'
import {entryCodec, type EntryFormat, jsonFormat} from './EntryCodec.js'
import {
  contentPrefix,
  type EntryFile,
  type EntryFilesOptions,
  entryFile
} from './EntryFiles.js'

type Record = {[key: string]: Json}

/**
 * Fixes what a tree merge made valid file by file but not as a whole:
 *
 * - an entry displaced from a path the other side took moves to the first
 *   free `<path>-<n>`;
 * - a parent one side removed comes back when the other side changed an
 *   entry below it;
 * - a shared field one side changed in some translations is merged and
 *   written to all of them;
 * - anchors of changed entries are made unique again.
 */
export function repairEntries(
  config: Config,
  options: EntryFilesOptions = {}
): Repair {
  return async input => {
    const files = new Files(config, options, input.store, input.trees.merged)
    await placeDisplaced(files, input)
    const changed = [...new Set([...input.changed, ...files.written()])]
      .sort()
      .filter(path => files.entry(path))
    await restoreParents(files, input, changed)
    await shareFields(files, input, changed)
    await uniqueAnchors(files, changed)
    return files.changes()
  }
}

/** The merged tree with the repair's changes over it */
class Files {
  #config: Config
  #options: EntryFilesOptions
  #store: ObjectStore
  #tree: string
  #puts = new Map<string, Uint8Array>()

  constructor(
    config: Config,
    options: EntryFilesOptions,
    store: ObjectStore,
    tree: string
  ) {
    this.#config = config
    this.#options = options
    this.#store = store
    this.#tree = tree
  }

  get schema(): Schema {
    return this.#config.schema
  }

  get prefix(): string {
    return contentPrefix(this.#config, this.#options)
  }

  get formats(): Array<EntryFormat> {
    return this.#options.formats ?? [jsonFormat]
  }

  entry(path: string): EntryFile | undefined {
    return entryFile(this.#config, path, this.#options)
  }

  async read(path: string, tree = this.#tree): Promise<Uint8Array | undefined> {
    if (tree === this.#tree && this.#puts.has(path)) return this.#puts.get(path)
    return readFile(this.#store, tree, path)
  }

  async record(path: string, tree?: string): Promise<Record | undefined> {
    const file = this.entry(path)
    const contents = await this.read(path, tree)
    if (!file || !contents) return undefined
    try {
      const value = this.codec(file).parse(contents)
      return isRecord(value) ? (value as Record) : undefined
    } catch {
      return undefined
    }
  }

  codec(file: EntryFile) {
    return entryCodec(this.#config.schema, file.format)
  }

  async exists(path: string): Promise<boolean> {
    return this.#puts.has(path) || (await this.read(path)) !== undefined
  }

  async taken(dir: string): Promise<boolean> {
    for (const path of this.#puts.keys())
      if (path.startsWith(`${dir}/`)) return true
    return (await listDir(this.#store, this.#tree, dir)).size > 0
  }

  /** Files below a directory of the merged tree, with the repair's own */
  async list(dir: string): Promise<Array<string>> {
    const listed = await listDir(this.#store, this.#tree, dir)
    const own = [...this.#puts.keys()].filter(path =>
      path.startsWith(`${dir}/`)
    )
    return [...new Set([...listed.keys(), ...own])].sort()
  }

  put(path: string, contents: Uint8Array): void {
    this.#puts.set(path, contents)
  }

  async write(path: string, record: Record): Promise<void> {
    const file = this.entry(path)!
    const like = (await this.read(path)) ?? new Uint8Array()
    this.put(path, this.codec(file).format(record, like))
  }

  written(): Array<string> {
    return [...this.#puts.keys()]
  }

  changes(): Array<Change> {
    return [...this.#puts.keys()]
      .sort()
      .map(path => ({op: 'put', path, contents: this.#puts.get(path)!}))
  }
}

/** The name of a file without its status and extension, and those */
function splitName(
  name: string,
  extension: string
): [base: string, suffix: string] {
  const stem = name.slice(0, name.length - extension.length)
  const status = ALT_STATUS.find(status => stem.endsWith(`.${status}`))
  if (!status) return [stem, extension]
  return [stem.slice(0, -status.length - 1), `.${status}${extension}`]
}

async function placeDisplaced(files: Files, input: RepairInput) {
  const displaced = input.displaced.toSorted((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  )
  for (const {path, entry} of displaced) {
    const contents = (await input.store.get([entry.sha])).get(entry.sha)?.data
    if (!contents) continue
    const slash = path.lastIndexOf('/')
    const dir = path.slice(0, slash + 1)
    const name = path.slice(slash + 1)
    const file = files.entry(path)
    const dot = name.lastIndexOf('.')
    const extension = file
      ? file.format.extension
      : dot > 0
        ? name.slice(dot)
        : ''
    const [base, suffix] = file
      ? splitName(name, extension)
      : [name.slice(0, name.length - extension.length), extension]
    for (let n = 1; ; n++) {
      const stem = `${base}-${n}`
      const candidates = file
        ? ['', ...ALT_STATUS.map(status => `.${status}`)].map(
            status => `${dir}${stem}${status}${extension}`
          )
        : [`${dir}${stem}${suffix}`]
      const used = await Promise.all(
        candidates.map(candidate => files.exists(candidate))
      )
      if (used.some(Boolean) || (file && (await files.taken(dir + stem))))
        continue
      const target = `${dir}${stem}${suffix}`
      files.put(target, contents)
      const record = file && (await files.record(target))
      if (record && typeof record.path === 'string')
        await files.write(target, {...record, path: stem})
      break
    }
  }
}

async function restoreParents(
  files: Files,
  input: RepairInput,
  changed: Array<string>
) {
  const {base, ours, theirs} = input.trees
  const sides = [
    base,
    ...(input.prefer === 'ours' ? [ours, theirs] : [theirs, ours])
  ]
  for (const path of changed) {
    const file = files.entry(path)!
    if (!(await files.exists(path))) continue
    const segments = file.path.split('/')
    for (let end = segments.length - 1; end > file.levelOffset; end--) {
      const dir = files.prefix + segments.slice(0, end).join('/')
      const versions = files.formats.flatMap(format =>
        ['', ...ALT_STATUS.map(status => `.${status}`)].map(
          status => `${dir}${status}${format.extension}`
        )
      )
      const present = await Promise.all(versions.map(v => files.exists(v)))
      if (present.some(Boolean)) continue
      for (const tree of sides) {
        if (!tree) continue
        const found = await Promise.all(
          versions.map(version => files.read(version, tree))
        )
        if (!found.some(Boolean)) continue
        found.forEach((contents, index) => {
          if (contents) files.put(versions[index], contents)
        })
        break
      }
    }
  }
}

async function shareFields(
  files: Files,
  input: RepairInput,
  changed: Array<string>
) {
  const roots = new Map<string, Promise<Map<string, Array<string>>>>()
  const done = new Set<string>()
  for (const path of changed) {
    const file = files.entry(path)!
    if (file.locale === null) continue
    const record = await files.record(path)
    if (!record) continue
    const id = record._i18nId ?? record._id
    const typeName = record._type
    if (typeof id !== 'string' || typeof typeName !== 'string') continue
    if (done.has(id)) continue
    done.add(id)
    const type = files.schema[typeName]
    if (!type) continue
    const shared = entries(Type.fields(type)).filter(
      ([, field]) => Field.options(field).shared
    )
    if (shared.length === 0) continue
    const rootDir =
      files.prefix +
      file.path
        .split('/')
        .slice(0, file.levelOffset - 1)
        .join('/')
    if (!roots.has(rootDir)) roots.set(rootDir, translationsIn(files, rootDir))
    const translations = (await roots.get(rootDir)!).get(id) ?? []
    if (translations.length < 2) continue
    const current = await Promise.all(translations.map(t => files.record(t)))
    for (const [key, field] of shared) {
      const values = current.map(record => record?.[key])
      if (values.every(value => dequal(value, values[0]))) continue
      const baseTree = input.trees.base
      const before = await Promise.all(
        translations.map(t =>
          baseTree ? files.record(t, baseTree) : undefined
        )
      )
      const baseValue = before.find(Boolean)?.[key]
      const sideValue = async (tree: string) => {
        for (const [index, translation] of translations.entries()) {
          const side = await files.record(translation, tree)
          if (side && !dequal(side[key], before[index]?.[key])) return side[key]
        }
        return baseValue
      }
      const merged = merge(
        Field.shape(field),
        baseValue,
        await sideValue(input.trees.ours),
        await sideValue(input.trees.theirs),
        {prefer: input.prefer}
      )
      for (const [index, translation] of translations.entries()) {
        const record = current[index]
        if (!record || dequal(record[key], merged)) continue
        const next = {...record}
        if (merged === undefined) delete next[key]
        else next[key] = merged
        current[index] = next
        await files.write(translation, next)
      }
    }
  }
}

/** The files of each entry id in a root, across its locales */
async function translationsIn(
  files: Files,
  rootDir: string
): Promise<Map<string, Array<string>>> {
  const result = new Map<string, Array<string>>()
  for (const path of await files.list(rootDir)) {
    if (!files.entry(path)) continue
    const record = await files.record(path)
    const id = record?._i18nId ?? record?._id
    if (typeof id !== 'string') continue
    result.set(id, [...(result.get(id) ?? []), path])
  }
  return result
}

async function uniqueAnchors(files: Files, changed: Array<string>) {
  for (const path of changed) {
    const record = await files.record(path)
    if (!record || typeof record._type !== 'string') continue
    const type = files.schema[record._type]
    if (!type) continue
    const normalized = Type.normalizeAnchors(type, record)
    if (normalized !== record && !dequal(normalized, record))
      await files.write(path, normalized as Record)
  }
}
