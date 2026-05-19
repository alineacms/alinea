import type {EntryStatus} from '../Entry.js'

export type EntryRowId = string
export type EntryNodeId = string
export type EntryLanguageId = string
export type EntryVersionId = string

export interface EntryVersionRow {
  rowId: EntryRowId
  versionId: EntryVersionId
  nodeId: EntryNodeId
  languageId: EntryLanguageId
  id: string
  type: string
  index: string
  title: string
  searchableText: string
  seeded: string | null
  rowHash: string
  fileHash: string
  data: Record<string, unknown>
  status: EntryStatus
  locale: string | null
  workspace: string
  root: string
  path: string
  parentDir: string
  childrenDir: string
  filePath: string
  level: number
}

export interface EntryLanguageRow {
  languageId: EntryLanguageId
  nodeId: EntryNodeId
  locale: string | null
  parentDir: string
  selfDir: string
  activeRowId: EntryRowId
  mainRowId: EntryRowId
  inheritedStatus?: EntryStatus
  url: string
  path: string
  seeded: string | null
  versionRowIds: Array<EntryRowId>
}

export interface EntryNodeRow {
  nodeId: EntryNodeId
  id: string
  index: string
  parentId: EntryNodeId | null
  parents: Array<EntryNodeId>
  workspace: string
  root: string
  type: string
  level: number
  languageIds: Array<EntryLanguageId>
  childNodeIds: Array<EntryNodeId>
}

export interface EntryRowStore {
  versions: Array<EntryVersionRow>
  languages: Array<EntryLanguageRow>
  nodes: Array<EntryNodeRow>
}
