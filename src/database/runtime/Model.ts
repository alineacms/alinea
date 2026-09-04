import type {EntryCoreRecord} from '../entry/Model.js'
import type {SerializedFrameDescriptor} from '../replica/Serialization.js'
import type {Tree} from '#/core/source/Tree.js'

export interface RuntimeEntryFrames {
  decodeKey: string
  data?: SerializedFrameDescriptor
  dataFormat?: 'runtime' | 'source'
  read?: RuntimeReadMetadata
  search?: SerializedFrameDescriptor
  references?: SerializedFrameDescriptor
}

export interface RuntimeIndexEntry extends EntryCoreRecord {
  frames?: RuntimeEntryFrames
}

export interface RuntimeDatabaseIndex {
  version: 1
  revision: string
  bundleId: string
  bundleUrl: string
  entries: ReadonlyArray<RuntimeIndexEntry>
  children: Readonly<Record<string, ReadonlyArray<string>>>
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
  tree: Tree
  blobs: Readonly<Record<string, RuntimeSourceBlob>>
}

export interface RuntimeSourceBlob {
  decodeKey: string
  frame: SerializedFrameDescriptor
}

export interface RuntimeReadMetadata {
  filePath: string
  parentDir: string
  childrenDir: string
  rowHash: string
  fileHash: string
  dataDefaults?: Readonly<Record<string, unknown>>
  /** Read-protected URL claims used to validate writes without opening data. */
  urlAliases?: ReadonlyArray<string>
}

export interface RuntimeDataFrame {
  filePath: string
  parentDir: string
  childrenDir: string
  rowHash: string
  fileHash: string
  data: Readonly<Record<string, unknown>>
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
