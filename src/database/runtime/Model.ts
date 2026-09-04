import type {EntryCoreRecord} from '../entry/Model.js'
import type {SerializedFrameDescriptor} from '../replica/Serialization.js'
import type {Config} from '#/core/Config.js'
import {entryFileName} from '#/core/util/EntryFilenames.js'
import {relative} from '#/core/util/Paths.js'
import {Config as ConfigHelpers} from '#/core/Config.js'

export interface RuntimeEntryFrames {
  decodeKey: string
  data?: SerializedFrameDescriptor
  search?: SerializedFrameDescriptor
  references?: SerializedFrameDescriptor
}

export interface RuntimeIndexEntry extends EntryCoreRecord {
  frames?: RuntimeEntryFrames
}

export interface RuntimeDatabaseIndex {
  revision: string
  bundleId: string
  bundleUrl: string
  entries: ReadonlyArray<RuntimeIndexEntry>
  source?: RuntimeSourceIndex
  /** Local-only metadata used to reopen a development checkpoint cheaply. */
  development?: RuntimeDevelopmentCheckpoint
}

export interface RuntimeDevelopmentCheckpoint {
  configHash: string
  files: Readonly<Record<string, RuntimeFileFingerprint>>
}

export interface RuntimeFileFingerprint {
  mtimeMs: number
  ctimeMs: number
  size: number
}

export interface RuntimeSourceIndex {
  treeFrame: RuntimeSourceFrame
  blobs: Readonly<Record<string, RuntimeSourceBlob>>
}

export interface RuntimeSourceFrame {
  decodeKey: string
  frame: SerializedFrameDescriptor
}

export interface RuntimeSourceBlob extends RuntimeSourceFrame {}

export interface RuntimeDataFrame {
  filePath: string
  parentDir: string
  childrenDir: string
  rowHash: string
  fileHash: string
  data: Readonly<Record<string, unknown>>
}

export interface RuntimeSourceDataFrame {
  filePath: string
  fileHash: string
  dataDefaults?: Readonly<Record<string, unknown>>
  contents: Uint8Array
}

export interface RuntimeSearchFrame {
  title: string
  searchableText: string
}

export interface RuntimeReferenceTarget {
  targetId: string
  fieldPath: string
  fieldLabel?: string
  linkId?: string
  linkType?: 'entry' | 'image' | 'file'
}

export interface RuntimeReferenceFrame {
  sourceFilePath: string
  references: ReadonlyArray<RuntimeReferenceTarget>
}

export function runtimeEntryVersionId(
  entryId: string,
  locale: string | null,
  status: string
): string {
  return `entry:${entryId}:${locale ?? ''}:${status}`
}

export function runtimeSourcePathResolver(
  config: Config,
  entries: ReadonlyArray<RuntimeIndexEntry>
): (entry: RuntimeIndexEntry) => string {
  const paths = new Map<string, string>()
  for (const entry of entries)
    if (entry.main)
      paths.set(languageKey(entry.entryId, entry.locale), entry.path)
  const contentDir = ConfigHelpers.contentDir(config)
  return entry => {
    const parentPaths = entry.parents.map(parentId => {
      const path = paths.get(languageKey(parentId, entry.locale))
      if (path === undefined)
        throw new Error(`Missing parent "${parentId}" for "${entry.entryId}"`)
      return path
    })
    return relative(
      contentDir,
      entryFileName(
        config,
        {
          workspace: entry.workspace,
          root: entry.root,
          locale: entry.locale,
          path: entry.path,
          status: entry.versionStatus
        },
        parentPaths
      )
    )
  }
}

function languageKey(entryId: string, locale: string | null): string {
  return `${entryId}\0${locale ?? ''}`
}
