import type {EntryStatus} from '#/core/Entry.js'
import type {FrameCompression} from '../replica/Types.js'
import type {
  RuntimeDatabaseIndex,
  RuntimeDevelopmentCheckpoint,
  RuntimeEntryFrames,
  RuntimeIndexEntry,
  RuntimeSourceIndex
} from './Model.js'
import {runtimeEntryVersionId} from './Model.js'

type PackedValue<Value> = Value | null

type PackedFrame = [
  offset: number,
  length: number,
  nonce: string,
  compression?: PackedValue<FrameCompression>,
  bundleId?: PackedValue<string>,
  bundleUrl?: PackedValue<string>
]

type PackedEntryFrames = [
  decodeKey: string,
  data?: PackedValue<PackedFrame>,
  search?: PackedValue<PackedFrame>,
  references?: PackedValue<PackedFrame>
]

type PackedEntry = [
  entryId: string,
  flags: number,
  type: number,
  title: string,
  seeded: string | null,
  workspace: number,
  root: number,
  locale: number,
  index: string,
  parents: ReadonlyArray<string>,
  path: string,
  url: string,
  frames: PackedValue<PackedEntryFrames>,
  urlAliases?: PackedValue<ReadonlyArray<string>>
]

export interface SerializedRuntimeDatabaseIndex {
  revision: string
  bundleId: string
  bundleUrl: string
  strings: {
    types: ReadonlyArray<string>
    workspaces: ReadonlyArray<string>
    roots: ReadonlyArray<string>
    locales: ReadonlyArray<string | null>
  }
  entries: ReadonlyArray<PackedEntry>
  source?: RuntimeSourceIndex
  development?: RuntimeDevelopmentCheckpoint
}

const statuses: ReadonlyArray<EntryStatus> = ['published', 'draft', 'archived']

export function serializeRuntimeDatabaseIndex(
  index: RuntimeDatabaseIndex
): SerializedRuntimeDatabaseIndex {
  const types = unique(index.entries.map(entry => entry.type))
  const workspaces = unique(index.entries.map(entry => entry.workspace))
  const roots = unique(index.entries.map(entry => entry.root))
  const locales = unique(index.entries.map(entry => entry.locale))
  const typeIds = positions(types)
  const workspaceIds = positions(workspaces)
  const rootIds = positions(roots)
  const localeIds = positions(locales)
  return {
    revision: index.revision,
    bundleId: index.bundleId,
    bundleUrl: index.bundleUrl,
    strings: {types, workspaces, roots, locales},
    entries: index.entries.map(
      entry =>
        trim([
          entry.entryId,
          entryFlags(entry),
          typeIds.get(entry.type)!,
          entry.title,
          entry.seeded,
          workspaceIds.get(entry.workspace)!,
          rootIds.get(entry.root)!,
          localeIds.get(entry.locale)!,
          entry.index,
          entry.parents,
          entry.path,
          entry.url,
          entry.frames ? packFrames(entry.frames) : null,
          entry.urlAliases?.length ? entry.urlAliases : null
        ]) as PackedEntry
    ),
    ...(index.source ? {source: index.source} : {}),
    ...(index.development ? {development: index.development} : {})
  }
}

export function deserializeRuntimeDatabaseIndex(
  index: SerializedRuntimeDatabaseIndex
): RuntimeDatabaseIndex {
  const {strings} = index
  return {
    revision: index.revision,
    bundleId: index.bundleId,
    bundleUrl: index.bundleUrl,
    entries: index.entries.map(entry => {
      const parents = entry[9]
      const flags = entry[1]
      const locale = strings.locales[entry[7]]!
      const versionStatus = statusAt((flags >> 3) & 3)
      const frames = entry[12] ? unpackFrames(entry[12]) : undefined
      return {
        kind: 'entry',
        id: runtimeEntryVersionId(entry[0], locale, versionStatus),
        queryable: Boolean(flags & 1),
        entryId: entry[0],
        versionStatus,
        status: statusAt((flags >> 5) & 3),
        active: Boolean(flags & 2),
        main: Boolean(flags & 4),
        type: strings.types[entry[2]]!,
        title: entry[3],
        seeded: entry[4],
        workspace: strings.workspaces[entry[5]]!,
        root: strings.roots[entry[6]]!,
        locale,
        level: parents.length,
        index: entry[8],
        parentId: parents.at(-1) ?? null,
        parents,
        path: entry[10],
        url: entry[11],
        urlAliases: entry[13] ?? [],
        frames
      }
    }),
    ...(index.source ? {source: index.source} : {}),
    ...(index.development ? {development: index.development} : {})
  }
}

function entryFlags(entry: RuntimeIndexEntry): number {
  return (
    (entry.queryable ? 1 : 0) |
    (entry.active ? 2 : 0) |
    (entry.main ? 4 : 0) |
    (statusCode(entry.versionStatus) << 3) |
    (statusCode(entry.status) << 5)
  )
}

function statusCode(status: EntryStatus): number {
  const code = statuses.indexOf(status)
  if (code < 0) throw new Error(`Unsupported entry status "${status}"`)
  return code
}

function statusAt(code: number): EntryStatus {
  const status = statuses[code]
  if (!status) throw new Error(`Unsupported packed entry status ${code}`)
  return status
}

function packFrames(frames: RuntimeEntryFrames): PackedEntryFrames {
  return trim([
    frames.decodeKey,
    frames.data ? packFrame(frames.data) : null,
    frames.search ? packFrame(frames.search) : null,
    frames.references ? packFrame(frames.references) : null
  ]) as PackedEntryFrames
}

function unpackFrames(frames: PackedEntryFrames): RuntimeEntryFrames {
  return {
    decodeKey: frames[0],
    ...(frames[1] ? {data: unpackFrame(frames[1])} : {}),
    ...(frames[2] ? {search: unpackFrame(frames[2])} : {}),
    ...(frames[3] ? {references: unpackFrame(frames[3])} : {})
  }
}

function packFrame(
  frame: NonNullable<RuntimeEntryFrames['data']>
): PackedFrame {
  return trim([
    frame.offset,
    frame.length,
    frame.nonce,
    frame.compression ?? null,
    frame.bundleId ?? null,
    frame.bundleUrl ?? null
  ]) as PackedFrame
}

function unpackFrame(frame: PackedFrame) {
  return {
    offset: frame[0],
    length: frame[1],
    nonce: frame[2],
    ...(frame[3] ? {compression: frame[3]} : {}),
    ...(frame[4] ? {bundleId: frame[4]} : {}),
    ...(frame[5] ? {bundleUrl: frame[5]} : {})
  }
}

function unique<Value>(values: ReadonlyArray<Value>): Array<Value> {
  return [...new Set(values)]
}

function positions<Value>(values: ReadonlyArray<Value>): Map<Value, number> {
  return new Map(values.map((value, index) => [value, index]))
}

function trim<Value>(values: Array<Value | null>): Array<Value | null> {
  while (values.at(-1) === null) values.pop()
  return values
}
