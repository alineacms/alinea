import {crypto} from '@alinea/iso'
import type {Config} from '#/core/Config.js'
import {parseRecord} from '#/core/EntryRecord.js'
import {aliasUrlsFromData} from '#/core/db/EntryAliases.js'
import {base64url} from '#/core/util/Encoding.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import type {Source} from '#/core/source/Source.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import type {EntryCoreRecord} from '../entry/Model.js'
import {readAccessClass} from '../entry/Release.js'
import {
  entrySeeds,
  loadParsedVersions,
  normalizeParsedVersions,
  parseVersion,
  type ParsedVersion
} from '../entry/Source.js'
import {
  encryptFrame,
  packEncryptedFrames,
  type EncryptedFrame
} from '../replica/Bundle.js'
import {serializeFrame} from '../replica/Serialization.js'
import type {FrameCompression} from '../replica/Types.js'
import type {
  RuntimeDatabaseIndex,
  RuntimeIndexEntry,
  RuntimeReadMetadata,
  RuntimeReferenceFrame,
  RuntimeSourceBlob,
  RuntimeSearchFrame
} from './Model.js'
import pLimit from 'p-limit'

const encoder = new TextEncoder()

export interface ExportRuntimeDatabaseOptions {
  config: Config
  bundleId: string
  bundleUrl: string
  source: Source
  compression?: FrameCompression
}

export interface RuntimeDatabaseExport {
  index: RuntimeDatabaseIndex
  bundle: Uint8Array
}

export interface ExportRuntimeSourceChangesOptions {
  config: Config
  previous: RuntimeDatabaseIndex
  tree: ReadonlyTree
  changes: ChangesBatch
  bundleId: string
  bundleUrl: string
  compression?: FrameCompression
}

/** Reconciles a source tree diff while opening only its added blobs. */
export async function exportRuntimeSourceChanges(
  options: ExportRuntimeSourceChangesOptions
): Promise<RuntimeDatabaseExport> {
  if (options.previous.revision !== options.changes.fromSha)
    throw new Error(
      `Runtime source diff starts at ${options.changes.fromSha}, expected ${options.previous.revision}`
    )
  const changed = new Map(
    options.changes.changes.map(change => [change.path, change])
  )
  const seeds = entrySeeds(options.config)
  const parsed: Array<ParsedVersion> = []
  for (const entry of options.previous.entries) {
    const read = entry.frames?.read
    if (!read || changed.has(read.filePath)) continue
    parsed.push(parsedRuntimeVersion(entry))
  }
  for (const change of options.changes.changes) {
    if (change.op === 'delete') continue
    if (!change.contents)
      throw new Error(`Missing changed source contents for "${change.path}"`)
    parsed.push(
      parseVersion(
        options.config,
        change.path,
        {sha: change.sha, contents: change.contents},
        seeds
      )
    )
  }

  const previousByPath = new Map(
    options.previous.entries.flatMap(entry => {
      const path = entry.frames?.read?.filePath
      return path ? [[path, entry] as const] : []
    })
  )
  const additions = new Map(
    options.changes.changes.flatMap(change =>
      change.op === 'add' && change.contents
        ? [[change.path, change.contents] as const]
        : []
    )
  )
  const normalized = normalizeParsedVersions(options.config, parsed)
  const prepared = await Promise.all(
    normalized.map(async ({core, version}) => {
      const contents = additions.get(version.filePath)
      if (!contents) {
        const previous = previousByPath.get(version.filePath)
        if (!previous)
          throw new Error(`Runtime entry not found for "${version.filePath}"`)
        return {entry: {...core, frames: previous.frames}}
      }
      return prepareRuntimeSourceEntry(options, core, version, contents)
    })
  )
  const encrypted = prepared.flatMap(item => item.encrypted ?? [])
  encrypted.sort((left, right) => frameOrder(left.id) - frameOrder(right.id))
  const packed = packEncryptedFrames(encrypted)
  const descriptors = new Map(packed.frames.map(frame => [frame.id, frame]))
  const descriptor = (frame: EncryptedFrame | undefined) => {
    if (!frame) return undefined
    const packedFrame = descriptors.get(frame.id)
    assert(packedFrame, `Missing packed frame "${frame.id}"`)
    return {
      ...serializeFrame(packedFrame),
      bundleId: options.bundleId,
      bundleUrl: options.bundleUrl
    }
  }
  const entries = prepared.map(item => {
    if (!item.decodeKey) return item.entry
    return {
      ...item.entry,
      frames: {
        decodeKey: item.decodeKey,
        data: descriptor(item.data),
        dataFormat: 'source' as const,
        read: item.read,
        search: descriptor(item.search),
        references: descriptor(item.references)
      }
    }
  })
  const liveShas = options.tree.shas
  const blobs: Record<string, RuntimeSourceBlob> = Object.fromEntries(
    Object.entries(options.previous.source?.blobs ?? {}).filter(([sha]) =>
      liveShas.has(sha)
    )
  )
  for (const item of prepared) {
    if (!item.decodeKey || !item.data || !item.version) continue
    const frame = descriptor(item.data)
    assert(frame)
    blobs[item.version.fileHash] = {decodeKey: item.decodeKey, frame}
  }
  return {
    index: {
      ...options.previous,
      revision: options.tree.sha,
      entries,
      children: childrenOf(entries),
      source: options.previous.source
        ? {tree: options.tree.toJSON(), blobs}
        : undefined,
      development: undefined
    },
    bundle: packed.contents
  }
}

interface PreparedRuntimeSourceChange {
  entry: RuntimeIndexEntry
  version?: ParsedVersion
  decodeKey?: string
  read?: RuntimeReadMetadata
  data?: EncryptedFrame
  search?: EncryptedFrame
  references?: EncryptedFrame
  encrypted?: Array<EncryptedFrame>
}

async function prepareRuntimeSourceEntry(
  options: Pick<
    ExportRuntimeDatabaseOptions,
    'config' | 'bundleId' | 'compression'
  >,
  core: EntryCoreRecord,
  version: ParsedVersion,
  contents: Uint8Array
): Promise<PreparedRuntimeSourceChange> {
  const type = options.config.schema[core.type]
  assert(type, `Unknown entry type "${core.type}"`)
  const key = crypto.getRandomValues(new Uint8Array(32))
  const decodeKey = base64url.stringify(key, {pad: false})
  const encrypt = (id: string, value: Uint8Array) =>
    encryptFrame({
      bundleId: options.bundleId,
      id,
      accessClassId: readAccessClass(core.id),
      key,
      contents: value,
      compression: options.compression
    })
  const references = core.queryable ? Type.references(type, version.data) : []
  const [data, search, referenceFrame] = await Promise.all([
    encrypt(dataFrameId(core.id), contents),
    core.queryable
      ? encrypt(
          searchFrameId(core.id),
          encoder.encode(
            JSON.stringify({
              title: core.title,
              searchableText: version.searchableText
            } satisfies RuntimeSearchFrame)
          )
        )
      : undefined,
    references.length > 0
      ? encrypt(
          referenceFrameId(core.id),
          encoder.encode(
            JSON.stringify({
              sourceFilePath: version.filePath,
              references
            } satisfies RuntimeReferenceFrame)
          )
        )
      : undefined
  ])
  const {data: stored} = parseRecord(
    JSON.parse(new TextDecoder().decode(contents))
  )
  const defaults = Object.fromEntries(
    Object.entries(version.data).filter(
      ([name]) => name !== 'path' && !(name in stored)
    )
  )
  const read: RuntimeReadMetadata = {
    filePath: version.filePath,
    parentDir: version.parentDir,
    childrenDir: version.childrenDir,
    rowHash: version.fileHash,
    fileHash: version.fileHash,
    dataDefaults: Object.keys(defaults).length > 0 ? defaults : undefined,
    urlAliases: aliasUrlsFromData(version.data)
  }
  return {
    entry: core,
    version,
    decodeKey,
    read,
    data,
    search,
    references: referenceFrame,
    encrypted: [data, search, referenceFrame].filter(
      (frame): frame is EncryptedFrame => Boolean(frame)
    )
  }
}

function parsedRuntimeVersion(entry: RuntimeIndexEntry): ParsedVersion {
  const read = entry.frames?.read
  assert(read, `Runtime entry "${entry.id}" has no source metadata`)
  return {
    filePath: read.filePath,
    fileHash: read.fileHash,
    entryId: entry.entryId,
    type: entry.type,
    index: entry.index,
    data: {title: entry.title},
    searchableText: '',
    seeded: entry.seeded,
    workspace: entry.workspace,
    root: entry.root,
    locale: entry.locale,
    path: entry.path,
    versionStatus: entry.versionStatus,
    parentDir: read.parentDir,
    childrenDir: read.childrenDir,
    level: entry.level
  }
}

interface PreparedSourceFrame {
  sha: string
  decodeKey: string
  frame: EncryptedFrame
}

export async function exportRuntimeDatabase(
  options: ExportRuntimeDatabaseOptions
): Promise<RuntimeDatabaseExport> {
  const source = await loadParsedVersions(options.config, options.source)
  const normalized = normalizeParsedVersions(options.config, source.versions)
  const limit = pLimit(32)
  const prepared = await Promise.all(
    normalized.map(({core, version}) =>
      limit(() =>
        prepareRuntimeSourceEntry(
          options,
          core,
          version,
          source.files.get(version.filePath)!.contents
        )
      )
    )
  )
  const represented = new Set(prepared.map(item => item.version!.fileHash))
  const sourceFrames = await prepareSourceFrames(
    options,
    source.files,
    represented
  )
  const frames = [
    ...prepared.flatMap(item => item.encrypted ?? []),
    ...sourceFrames.map(item => item.frame)
  ]
  frames.sort((left, right) => frameOrder(left.id) - frameOrder(right.id))
  const packed = packEncryptedFrames(frames)
  const descriptors = new Map(packed.frames.map(frame => [frame.id, frame]))
  const descriptor = (frame: EncryptedFrame | undefined) =>
    frame ? serializeFrame(descriptors.get(frame.id)!) : undefined
  const entries: Array<RuntimeIndexEntry> = prepared.map(item => {
    return {
      ...item.entry,
      frames: item.decodeKey
        ? {
            decodeKey: item.decodeKey,
            data: descriptor(item.data),
            dataFormat: 'source' as const,
            read: item.read,
            search: descriptor(item.search),
            references: descriptor(item.references)
          }
        : undefined
    }
  })
  return {
    index: {
      version: 1,
      revision: source.tree.sha,
      bundleId: options.bundleId,
      bundleUrl: options.bundleUrl,
      entries,
      children: childrenOf(entries),
      source: {
        tree: source.tree.toJSON(),
        blobs: sourceBlobs(prepared, sourceFrames, descriptors)
      }
    },
    bundle: packed.contents
  }
}

async function prepareSourceFrames(
  options: Pick<ExportRuntimeDatabaseOptions, 'bundleId' | 'compression'>,
  files: ReadonlyMap<string, import('../entry/Source.js').EntrySourceFile>,
  represented: ReadonlySet<string>
): Promise<Array<PreparedSourceFrame>> {
  const blobs = new Map<string, Uint8Array>()
  for (const file of files.values()) blobs.set(file.sha, file.contents)
  const shas = [...blobs.keys()].filter(sha => !represented.has(sha))
  if (shas.length === 0) return []
  const key = crypto.getRandomValues(new Uint8Array(32))
  const decodeKey = base64url.stringify(key, {pad: false})
  const limit = pLimit(32)
  return Promise.all(
    shas.map(sha =>
      limit(async () => {
        const contents = blobs.get(sha)
        if (!contents) throw new Error(`Missing source blob "${sha}"`)
        return {
          sha,
          decodeKey,
          frame: await encryptFrame({
            bundleId: options.bundleId,
            id: sourceFrameId(sha),
            accessClassId: `source:${options.bundleId}`,
            key,
            contents,
            compression: options.compression
          })
        }
      })
    )
  )
}

function sourceBlobs(
  entries: ReadonlyArray<PreparedRuntimeSourceChange>,
  sources: ReadonlyArray<PreparedSourceFrame>,
  descriptors: ReadonlyMap<
    string,
    import('../replica/Types.js').FrameDescriptor
  >
): Record<string, RuntimeSourceBlob> {
  const blobs: Record<string, RuntimeSourceBlob> = {}
  for (const entry of entries) {
    if (!entry.version || !entry.decodeKey || !entry.data) continue
    blobs[entry.version.fileHash] = {
      decodeKey: entry.decodeKey,
      frame: serializeFrame(descriptors.get(entry.data.id)!)
    }
  }
  for (const source of sources)
    blobs[source.sha] = {
      decodeKey: source.decodeKey,
      frame: serializeFrame(descriptors.get(source.frame.id)!)
    }
  return blobs
}

function childrenOf(
  entries: ReadonlyArray<RuntimeIndexEntry>
): Record<string, ReadonlyArray<string>> {
  const children: Record<string, Array<string>> = {}
  for (const entry of entries) {
    const parent = entry.parentId ?? ''
    ;(children[parent] ??= []).push(entry.id)
  }
  return children
}

function dataFrameId(entry: string): string {
  return `data:${entry}`
}

function searchFrameId(entry: string): string {
  return `search:${entry}`
}

function referenceFrameId(entry: string): string {
  return `references:${entry}`
}

function sourceFrameId(sha: string): string {
  return `source:${sha}`
}

function frameOrder(id: string): number {
  if (id.startsWith('data:')) return 0
  if (id.startsWith('search:')) return 1
  if (id.startsWith('references:')) return 2
  return 3
}
