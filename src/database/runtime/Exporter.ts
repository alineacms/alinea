import {crypto} from '@alinea/iso'
import type {Config} from '#/core/Config.js'
import {parseRecord} from '#/core/EntryRecord.js'
import {base64url} from '#/core/util/Encoding.js'
import {accumulate} from '#/core/util/Async.js'
import type {Source} from '#/core/source/Source.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {Type} from '#/core/Type.js'
import type {DatabaseSnapshot} from '../Database.js'
import {allEntries} from '../entry/Indexes.js'
import type {
  AlineaDatabaseRecord,
  EntryCoreRecord,
  EntryLinkRecord,
  EntryPayloadRecord,
  EntryReadRecord,
  EntrySearchRecord
} from '../entry/Model.js'
import {readAccessClass} from '../entry/Release.js'
import {
  encryptFrame,
  packEncryptedFrames,
  type EncryptedFrame
} from '../replica/Bundle.js'
import {
  serializeFrame,
  type SerializedFrameDescriptor
} from '../replica/Serialization.js'
import type {FrameCompression} from '../replica/Types.js'
import type {
  RuntimeDatabaseIndex,
  RuntimeDataFrame,
  RuntimeIndexEntry,
  RuntimeReadMetadata,
  RuntimeReferenceFrame,
  RuntimeSourceBlob,
  RuntimeSearchFrame
} from './Model.js'
import pLimit from 'p-limit'

const encoder = new TextEncoder()

export interface ExportRuntimeDatabaseOptions {
  bundleId: string
  bundleUrl: string
  snapshot: DatabaseSnapshot<AlineaDatabaseRecord>
  source?: Source
  compression?: FrameCompression
}

export interface RuntimeDatabaseExport {
  index: RuntimeDatabaseIndex
  bundle: Uint8Array
}

export interface RuntimeEntryOverlayExport extends RuntimeDatabaseExport {
  entry: RuntimeIndexEntry
}

export interface ExportRuntimeDeltaOptions {
  previous: RuntimeDatabaseIndex
  next: RuntimeDatabaseExport
  bundleId: string
  bundleUrl: string
}

/** Reuses unchanged frames and packs only changed full-export frames. */
export function exportRuntimeDelta(
  options: ExportRuntimeDeltaOptions
): RuntimeDatabaseExport {
  if (options.next.index.bundleId !== options.bundleId)
    throw new Error('Runtime delta must retain its encrypted bundle id')
  const previousEntries = new Map(
    options.previous.entries.map(entry => [entry.id, entry])
  )
  const relocated = new Map<string, SerializedFrameDescriptor>()
  const chunks: Array<Uint8Array> = []
  let offset = 0
  function relocate(frame: SerializedFrameDescriptor) {
    const key = `${frame.id}\0${frame.cipherHash}`
    const cached = relocated.get(key)
    if (cached) return cached
    const contents = options.next.bundle.slice(
      frame.offset,
      frame.offset + frame.length
    )
    const descriptor = {
      ...frame,
      bundleId: options.bundleId,
      bundleUrl: options.bundleUrl,
      offset
    }
    relocated.set(key, descriptor)
    chunks.push(contents)
    offset += contents.length
    return descriptor
  }
  const entries = options.next.index.entries.map(entry => {
    const previous = previousEntries.get(entry.id)
    if (previous && reusableEntryFrames(previous, entry))
      return {...entry, frames: previous.frames}
    const frames = entry.frames
    if (!frames) return entry
    return {
      ...entry,
      frames: {
        ...frames,
        data: frames.data && relocate(frames.data),
        search: frames.search && relocate(frames.search),
        references: frames.references && relocate(frames.references)
      }
    }
  })
  const previousBlobs = options.previous.source?.blobs ?? {}
  const source = options.next.index.source
  const blobs = source
    ? Object.fromEntries(
        Object.entries(source.blobs).map(([sha, blob]) => {
          const previous = previousBlobs[sha]
          return [
            sha,
            previous ?? {...blob, frame: relocate(blob.frame)}
          ] as const
        })
      )
    : undefined
  const bundle = new Uint8Array(offset)
  let position = 0
  for (const chunk of chunks) {
    bundle.set(chunk, position)
    position += chunk.length
  }
  return {
    index: {
      ...options.next.index,
      bundleId: options.previous.bundleId,
      bundleUrl: options.previous.bundleUrl,
      entries,
      source: source ? {...source, blobs: blobs!} : undefined
    },
    bundle
  }
}

export interface ExportRuntimeEntryOverlayOptions {
  config: Config
  index: RuntimeDatabaseIndex
  bundleId: string
  bundleUrl: string
  filePath: string
  fileHash: string
  contents: Uint8Array
  tree: ReadonlyTree
  compression?: FrameCompression
}

/** Replaces one non-structural entry without reading any other payload. */
export async function exportRuntimeEntryOverlay(
  options: ExportRuntimeEntryOverlayOptions
): Promise<RuntimeEntryOverlayExport | undefined> {
  const previous = options.index.entries.find(
    entry => entry.frames?.read?.filePath === options.filePath
  )
  const read = previous?.frames?.read
  if (!previous || !read) return
  const {meta, data: stored} = parseRecord(
    JSON.parse(new TextDecoder().decode(options.contents))
  )
  if (
    meta.id !== previous.entryId ||
    meta.type !== previous.type ||
    meta.index !== previous.index
  )
    return
  const entryType = options.config.schema[previous.type]
  if (!entryType) return
  const data: Record<string, unknown> = {
    path: previous.path,
    ...read.dataDefaults,
    ...stored
  }
  if (data.path !== previous.path) return
  const title = data.title
  if (typeof title !== 'string') return
  const key = crypto.getRandomValues(new Uint8Array(32))
  const decodeKey = base64url.stringify(key, {pad: false})
  const accessClassId = readAccessClass(previous.id)
  const encrypt = (id: string, contents: Uint8Array) =>
    encryptFrame({
      bundleId: options.bundleId,
      id,
      accessClassId,
      key,
      contents,
      compression: options.compression
    })
  const references = Type.references(entryType, data)
  const [dataFrame, searchFrame, referenceFrame] = await Promise.all([
    encrypt(dataFrameId(previous.id), options.contents),
    encrypt(
      searchFrameId(previous.id),
      encoder.encode(
        JSON.stringify({
          title,
          searchableText: Type.searchableText(entryType, data)
        } satisfies RuntimeSearchFrame)
      )
    ),
    references.length > 0
      ? encrypt(
          referenceFrameId(previous.id),
          encoder.encode(
            JSON.stringify({
              sourceFilePath: options.filePath,
              references
            } satisfies RuntimeReferenceFrame)
          )
        )
      : undefined
  ])
  const frames = [dataFrame, searchFrame, referenceFrame].filter(
    (frame): frame is EncryptedFrame => Boolean(frame)
  )
  frames.sort((left, right) => frameOrder(left.id) - frameOrder(right.id))
  const packed = packEncryptedFrames(frames)
  const descriptors = new Map(packed.frames.map(frame => [frame.id, frame]))
  const descriptor = (id: string) => {
    const frame = descriptors.get(id)
    return frame
      ? {
          ...serializeFrame(frame),
          bundleId: options.bundleId,
          bundleUrl: options.bundleUrl
        }
      : undefined
  }
  const updated: RuntimeIndexEntry = {
    ...previous,
    title,
    frames: {
      decodeKey,
      data: descriptor(dataFrame.id),
      dataFormat: 'source',
      read: {
        ...read,
        rowHash: options.fileHash,
        fileHash: options.fileHash
      },
      search: descriptor(searchFrame.id),
      references: referenceFrame && descriptor(referenceFrame.id)
    }
  }
  const source = options.index.source
  const tree = options.tree.toJSON()
  const liveShas = new Set(options.tree.shas)
  const blobs = source
    ? Object.fromEntries(
        Object.entries(source.blobs).filter(([sha]) => liveShas.has(sha))
      )
    : {}
  blobs[options.fileHash] = {
    decodeKey,
    frame: updated.frames!.data!
  }
  return {
    index: {
      ...options.index,
      revision: options.tree.sha,
      entries: options.index.entries.map(entry =>
        entry.id === updated.id ? updated : entry
      ),
      source: source ? {tree, blobs} : undefined
    },
    bundle: packed.contents,
    entry: updated
  }
}

interface PreparedEntry {
  core: EntryCoreRecord
  decodeKey?: string
  data?: EncryptedFrame
  dataFormat?: 'runtime' | 'source'
  read?: RuntimeReadMetadata
  sourceSha?: string
  search?: EncryptedFrame
  references?: EncryptedFrame
}

interface LoadedSource {
  tree: import('#/core/source/Tree.js').Tree
  blobs: ReadonlyMap<string, Uint8Array>
}

interface PreparedSourceFrame {
  sha: string
  decodeKey: string
  frame: EncryptedFrame
}

export async function exportRuntimeDatabase(
  options: ExportRuntimeDatabaseOptions
): Promise<RuntimeDatabaseExport> {
  const reads = new Map<string, EntryReadRecord>()
  const payloads = new Map<string, EntryPayloadRecord>()
  const searches = new Map<string, EntrySearchRecord>()
  const references = new Map<string, Array<EntryLinkRecord>>()
  for (const record of options.snapshot.records()) {
    switch (record.kind) {
      case 'entryRead':
        reads.set(record.entryVersionId, record)
        break
      case 'payload':
        payloads.set(record.id, record)
        break
      case 'search':
        if (record.audience === 'read')
          searches.set(record.entryVersionId, record)
        break
      case 'link': {
        const items = references.get(record.sourceVersionId) ?? []
        items.push(record)
        references.set(record.sourceVersionId, items)
        break
      }
    }
  }

  const cores = options.snapshot
    .scan(allEntries, 'all')
    .map(reference => options.snapshot.get(reference.id))
    .filter((record): record is EntryCoreRecord => record?.kind === 'entry')
  const limit = pLimit(32)
  const source = await loadSource(options.source)
  const prepared = await Promise.all(
    cores.map(core =>
      limit(() =>
        prepareEntry(
          options,
          core,
          reads.get(core.id),
          payloads,
          searches.get(core.id),
          references.get(core.id) ?? [],
          source?.blobs
        )
      )
    )
  )
  const representedSource = new Set(
    prepared.flatMap(entry => (entry.sourceSha ? [entry.sourceSha] : []))
  )
  const sourceFrames = await prepareSourceFrames(
    options,
    source,
    representedSource
  )
  const frames = [
    ...prepared.flatMap(entry =>
      [entry.data, entry.search, entry.references].filter(
        (frame): frame is EncryptedFrame => Boolean(frame)
      )
    ),
    ...sourceFrames.map(source => source.frame)
  ]
  frames.sort((left, right) => frameOrder(left.id) - frameOrder(right.id))
  const packed = packEncryptedFrames(frames)
  const descriptors = new Map(packed.frames.map(frame => [frame.id, frame]))
  const entries: Array<RuntimeIndexEntry> = prepared.map(entry => {
    const data = descriptors.get(dataFrameId(entry.core.id))
    const search = descriptors.get(searchFrameId(entry.core.id))
    const reference = descriptors.get(referenceFrameId(entry.core.id))
    const hasFrames = data || search || reference
    return {
      ...entry.core,
      frames:
        hasFrames && entry.decodeKey
          ? {
              decodeKey: entry.decodeKey,
              data: data && serializeFrame(data),
              dataFormat: entry.dataFormat,
              read: entry.read,
              search: search && serializeFrame(search),
              references: reference && serializeFrame(reference)
            }
          : undefined
    }
  })
  return {
    index: {
      version: 1,
      revision: options.snapshot.revision,
      bundleId: options.bundleId,
      bundleUrl: options.bundleUrl,
      entries,
      children: childrenOf(entries),
      source: source
        ? {
            tree: source.tree,
            blobs: sourceBlobs(prepared, sourceFrames, descriptors)
          }
        : undefined
    },
    bundle: packed.contents
  }
}

async function loadSource(source?: Source): Promise<LoadedSource | undefined> {
  if (!source) return
  const tree = await source.getTree()
  const shas = [...tree.shas]
  const blobs = new Map(await accumulate(source.getBlobs(shas)))
  return {tree: tree.toJSON(), blobs}
}

async function prepareSourceFrames(
  options: ExportRuntimeDatabaseOptions,
  source: LoadedSource | undefined,
  represented: ReadonlySet<string>
): Promise<Array<PreparedSourceFrame>> {
  if (!source) return []
  const shas = [...source.blobs.keys()].filter(sha => !represented.has(sha))
  if (shas.length === 0) return []
  const key = crypto.getRandomValues(new Uint8Array(32))
  const decodeKey = base64url.stringify(key, {pad: false})
  const limit = pLimit(32)
  return Promise.all(
    shas.map(sha =>
      limit(async () => {
        const contents = source.blobs.get(sha)
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

async function prepareEntry(
  options: ExportRuntimeDatabaseOptions,
  core: EntryCoreRecord,
  read: EntryReadRecord | undefined,
  payloads: ReadonlyMap<string, EntryPayloadRecord>,
  search: EntrySearchRecord | undefined,
  references: ReadonlyArray<EntryLinkRecord>,
  sourceBlobs: ReadonlyMap<string, Uint8Array> | undefined
): Promise<PreparedEntry> {
  const payload = read ? payloads.get(read.payloadId) : undefined
  if (!payload && !search && references.length === 0) return {core}
  const key = crypto.getRandomValues(new Uint8Array(32))
  const accessClassId = readAccessClass(core.id)
  const frame = (id: string, contents: Uint8Array) =>
    encryptFrame({
      bundleId: options.bundleId,
      id,
      accessClassId,
      key,
      contents,
      compression: options.compression
    })
  const dataValue: RuntimeDataFrame | undefined =
    read && payload
      ? {
          filePath: read.filePath,
          parentDir: read.parentDir,
          childrenDir: read.childrenDir,
          rowHash: read.rowHash,
          fileHash: read.fileHash,
          data: payload.data
        }
      : undefined
  const sourceContents = read ? sourceBlobs?.get(read.fileHash) : undefined
  const searchValue: RuntimeSearchFrame | undefined = search
    ? {title: search.title, searchableText: search.searchableText}
    : undefined
  const referenceValue: RuntimeReferenceFrame | undefined =
    references.length > 0
      ? {
          sourceFilePath: references[0].sourceFilePath,
          references: references.map(reference => ({
            targetId: reference.targetId,
            fieldPath: reference.fieldPath,
            fieldLabel: reference.fieldLabel,
            linkId: reference.linkId,
            linkType: reference.linkType
          }))
        }
      : undefined
  const [data, searchFrame, referenceFrame] = await Promise.all([
    dataValue
      ? frame(
          dataFrameId(core.id),
          sourceContents ?? encoder.encode(JSON.stringify(dataValue))
        )
      : undefined,
    searchValue
      ? frame(
          searchFrameId(core.id),
          encoder.encode(JSON.stringify(searchValue))
        )
      : undefined,
    referenceValue
      ? frame(
          referenceFrameId(core.id),
          encoder.encode(JSON.stringify(referenceValue))
        )
      : undefined
  ])
  return {
    core,
    decodeKey: base64url.stringify(key, {pad: false}),
    data,
    dataFormat: sourceContents ? 'source' : 'runtime',
    read:
      sourceContents && read && payload
        ? readMetadata(read, sourceContents, payload.data)
        : undefined,
    sourceSha: sourceContents ? read?.fileHash : undefined,
    search: searchFrame,
    references: referenceFrame
  }
}

function readMetadata(
  read: EntryReadRecord,
  source: Uint8Array,
  data: Readonly<Record<string, unknown>>
): RuntimeReadMetadata {
  const {data: stored} = parseRecord(
    JSON.parse(new TextDecoder().decode(source))
  )
  const defaults = Object.fromEntries(
    Object.entries(data).filter(
      ([name]) => name !== 'path' && !(name in stored)
    )
  )
  return {
    filePath: read.filePath,
    parentDir: read.parentDir,
    childrenDir: read.childrenDir,
    rowHash: read.rowHash,
    fileHash: read.fileHash,
    dataDefaults: Object.keys(defaults).length > 0 ? defaults : undefined
  }
}

function sourceBlobs(
  entries: ReadonlyArray<PreparedEntry>,
  sources: ReadonlyArray<PreparedSourceFrame>,
  descriptors: ReadonlyMap<
    string,
    import('../replica/Types.js').FrameDescriptor
  >
): Record<string, RuntimeSourceBlob> {
  const blobs: Record<string, RuntimeSourceBlob> = {}
  for (const entry of entries) {
    if (!entry.sourceSha || !entry.decodeKey || !entry.data) continue
    blobs[entry.sourceSha] = {
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

function reusableEntryFrames(
  previous: RuntimeIndexEntry,
  next: RuntimeIndexEntry
): boolean {
  const previousRead = previous.frames?.read
  const nextRead = next.frames?.read
  if (!previousRead || !nextRead) return !previous.frames && !next.frames
  return (
    previousRead.fileHash === nextRead.fileHash &&
    previousRead.filePath === nextRead.filePath
  )
}
