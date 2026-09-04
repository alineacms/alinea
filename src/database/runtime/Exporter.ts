import {crypto} from '@alinea/iso'
import type {Config} from '#/core/Config.js'
import {parseRecord} from '#/core/EntryRecord.js'
import {aliasUrlsFromData} from '#/core/db/EntryAliases.js'
import {base64url} from '#/core/util/Encoding.js'
import {dirname, join} from '#/core/util/Paths.js'
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
import {
  runtimeEntryVersionId,
  runtimeSourcePathResolver,
  type RuntimeDatabaseIndex,
  type RuntimeIndexEntry,
  type RuntimeReferenceFrame,
  type RuntimeSearchFrame
} from './Model.js'
import pLimit from 'p-limit'
import {
  encodeRuntimeSourceDataFrame,
  encodeRuntimeReferenceFrame,
  encodeRuntimeSearchFrame,
  encodeRuntimeSourceTree
} from './FrameSerialization.js'
import {createRuntimeDelta, type RuntimeDeltaArtifact} from './Snapshot.js'

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
): Promise<RuntimeDeltaArtifact> {
  const previousSource = options.previous.source
  assert(previousSource, 'Runtime source changes require source metadata')
  if (options.previous.revision !== options.changes.fromSha)
    throw new Error(
      `Runtime source diff starts at ${options.changes.fromSha}, expected ${options.previous.revision}`
    )
  const changed = new Map(
    options.changes.changes.map(change => [change.path, change])
  )
  const previousFilePath = runtimeSourcePathResolver(
    options.config,
    options.previous.entries
  )
  const seeds = entrySeeds(options.config)
  const parsed: Array<ParsedVersion> = []
  for (const entry of options.previous.entries) {
    if (!entry.frames?.data || changed.has(previousFilePath(entry))) continue
    parsed.push(
      parsedRuntimeVersion(
        entry,
        previousFilePath(entry),
        options.tree.getLeaf(previousFilePath(entry)).sha
      )
    )
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
      const path = entry.frames?.data ? previousFilePath(entry) : undefined
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
        return {
          entry: {
            ...core,
            id: runtimeEntryVersionId(
              core.entryId,
              core.locale,
              core.versionStatus
            ),
            urlAliases: previous.urlAliases ?? [],
            frames: previous.frames
          },
          version
        }
      }
      return prepareRuntimeSourceEntry(options, core, version, contents)
    })
  )
  const sourceTree = await prepareSourceTreeFrame(
    options,
    options.tree,
    representedEntries(prepared)
  )
  const encrypted = [
    ...prepared.flatMap(item => item.encrypted ?? []),
    sourceTree.frame
  ]
  encrypted.sort((left, right) => frameOrder(left.id) - frameOrder(right.id))
  const packed = packEncryptedFrames(encrypted)
  const descriptors = new Map(packed.frames.map(frame => [frame.id, frame]))
  const descriptor = (frame: EncryptedFrame | undefined) => {
    if (!frame) return undefined
    const packedFrame = descriptors.get(frame.id)
    assert(packedFrame, `Missing packed frame "${frame.id}"`)
    return Object.assign(serializeFrame(packedFrame), {
      bundleId: options.bundleId,
      bundleUrl: options.bundleUrl
    })
  }
  const entries = prepared.map(item => {
    if (!item.decodeKey) return item.entry
    return {
      ...item.entry,
      frames: {
        decodeKey: item.decodeKey,
        data: descriptor(item.data),
        search: descriptor(item.search),
        references: descriptor(item.references)
      }
    }
  })
  const next: RuntimeDatabaseIndex = {
    ...options.previous,
    revision: options.tree.sha,
    entries,
    source: {
      treeFrame: {
        decodeKey: sourceTree.decodeKey,
        frame: descriptor(sourceTree.frame)!
      }
    },
    development: undefined
  }
  return {
    delta: createRuntimeDelta(
      options.previous,
      next,
      options.bundleId,
      options.bundleUrl
    ),
    bundle: packed.contents
  }
}

interface PreparedRuntimeSourceChange {
  entry: RuntimeIndexEntry
  version?: ParsedVersion
  decodeKey?: string
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
  const entry: RuntimeIndexEntry = {
    ...core,
    id: runtimeEntryVersionId(core.entryId, core.locale, core.versionStatus),
    urlAliases: aliasUrlsFromData(version.data)
  }
  const type = options.config.schema[entry.type]
  assert(type, `Unknown entry type "${core.type}"`)
  const key = crypto.getRandomValues(new Uint8Array(32))
  const decodeKey = base64url.stringify(key, {pad: false})
  const encrypt = (id: string, value: Uint8Array) =>
    encryptFrame({
      bundleId: options.bundleId,
      id,
      accessClassId: readAccessClass(entry.id),
      key,
      contents: value,
      compression: options.compression
    })
  const references = entry.queryable ? Type.references(type, version.data) : []
  const {data: stored} = parseRecord(
    JSON.parse(new TextDecoder().decode(contents))
  )
  const defaults = Object.fromEntries(
    Object.entries(version.data).filter(
      ([name]) => name !== 'path' && !(name in stored)
    )
  )
  const [data, search, referenceFrame] = await Promise.all([
    encrypt(
      dataFrameId(entry.id),
      encodeRuntimeSourceDataFrame({
        filePath: version.filePath,
        fileHash: version.fileHash,
        dataDefaults: Object.keys(defaults).length > 0 ? defaults : undefined,
        contents
      })
    ),
    entry.queryable
      ? encrypt(
          searchFrameId(entry.id),
          encodeRuntimeSearchFrame({
            title: entry.title,
            searchableText: version.searchableText
          } satisfies RuntimeSearchFrame)
        )
      : undefined,
    references.length > 0
      ? encrypt(
          referenceFrameId(entry.id),
          encodeRuntimeReferenceFrame({
            sourceFilePath: version.filePath,
            references
          } satisfies RuntimeReferenceFrame)
        )
      : undefined
  ])
  return {
    entry,
    version,
    decodeKey,
    data,
    search,
    references: referenceFrame,
    encrypted: [data, search, referenceFrame].filter(
      (frame): frame is EncryptedFrame => Boolean(frame)
    )
  }
}

function parsedRuntimeVersion(
  entry: RuntimeIndexEntry,
  filePath: string,
  fileHash: string
): ParsedVersion {
  const parentDir = dirname(filePath)
  return {
    filePath,
    fileHash,
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
    url: entry.url,
    versionStatus: entry.versionStatus,
    parentDir,
    childrenDir: join(parentDir, entry.path),
    level: entry.level
  }
}

function representedEntries(
  entries: ReadonlyArray<PreparedRuntimeSourceChange>
): ReadonlyMap<string, number> {
  return new Map(
    entries.flatMap((entry, position) =>
      entry.version ? [[entry.version.fileHash, position] as const] : []
    )
  )
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
  const sourceTree = await prepareSourceTreeFrame(
    options,
    source.tree,
    representedEntries(prepared)
  )
  const frames = [
    ...prepared.flatMap(item => item.encrypted ?? []),
    sourceTree.frame
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
            search: descriptor(item.search),
            references: descriptor(item.references)
          }
        : undefined
    }
  })
  return {
    index: {
      revision: source.tree.sha,
      bundleId: options.bundleId,
      bundleUrl: options.bundleUrl,
      entries,
      source: {
        treeFrame: {
          decodeKey: sourceTree.decodeKey,
          frame: descriptor(sourceTree.frame)!
        }
      }
    },
    bundle: packed.contents
  }
}

async function prepareSourceTreeFrame(
  options: Pick<ExportRuntimeDatabaseOptions, 'bundleId' | 'compression'>,
  tree: ReadonlyTree,
  entries: ReadonlyMap<string, number>
): Promise<PreparedSourceFrame> {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const decodeKey = base64url.stringify(key, {pad: false})
  return {
    sha: tree.sha,
    decodeKey,
    frame: await encryptFrame({
      bundleId: options.bundleId,
      id: sourceTreeFrameId(),
      accessClassId: `source:${options.bundleId}`,
      key,
      contents: encodeRuntimeSourceTree(tree, entries),
      compression: options.compression
    })
  }
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

function sourceTreeFrameId(): string {
  return 'source:tree'
}

function frameOrder(id: string): number {
  if (id.startsWith('data:')) return 0
  if (id.startsWith('search:')) return 1
  if (id.startsWith('references:')) return 2
  return 3
}
