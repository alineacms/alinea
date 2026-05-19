import type {EntryStatus} from '../Entry.js'
import type {FlatTree} from '../source/Tree.js'
import type {EntryManifest} from './EntryManifest.js'
import {ENTRY_SNAPSHOT_VERSION, type EntrySnapshot} from './EntrySnapshot.js'
import {createEntrySnapshotIndexes} from './EntrySnapshotIndex.js'
import type {
  EntryLanguageRow,
  EntryNodeRow,
  EntryRowStore,
  EntryVersionRow
} from './EntryRows.js'

export interface CompactEntrySnapshot {
  v: typeof ENTRY_SNAPSHOT_VERSION
  g: string
  m: EntryManifest
  t: FlatTree
  r: CompactEntryRows
  s?: EntrySnapshot['search']
}

export interface CompactEntryRows {
  v: Array<CompactEntryVersionRow>
  l: Array<CompactEntryLanguageRow>
  n: Array<CompactEntryNodeRow>
}

export type CompactEntryVersionRow = [
  rowId: string,
  versionId: string,
  nodeId: string,
  languageId: string,
  id: string,
  type: string,
  index: string,
  title: string,
  searchableText: string,
  seeded: string | null,
  rowHash: string,
  fileHash: string,
  data: Record<string, unknown>,
  status: EntryStatus,
  locale: string | null,
  workspace: string,
  root: string,
  path: string,
  parentDir: string,
  childrenDir: string,
  filePath: string,
  level: number
]

export type CompactEntryLanguageRow = [
  languageId: string,
  nodeId: string,
  locale: string | null,
  parentDir: string,
  selfDir: string,
  activeRowId: string,
  mainRowId: string,
  inheritedStatus: EntryStatus | null,
  url: string,
  path: string,
  seeded: string | null,
  versionRowIds: Array<string>
]

export type CompactEntryNodeRow = [
  nodeId: string,
  id: string,
  index: string,
  parentId: string | null,
  parents: Array<string>,
  workspace: string,
  root: string,
  type: string,
  level: number,
  languageIds: Array<string>,
  childNodeIds: Array<string>
]

export function compactEntrySnapshot(
  snapshot: EntrySnapshot
): CompactEntrySnapshot {
  const compact: CompactEntrySnapshot = {
    v: snapshot.version,
    g: snapshot.graphSha,
    m: snapshot.manifest,
    t: snapshot.tree,
    r: compactEntryRows(snapshot.rows)
  }
  if (snapshot.search) compact.s = snapshot.search
  return compact
}

export function expandEntrySnapshot(
  compact: CompactEntrySnapshot
): EntrySnapshot {
  const rows = expandEntryRows(compact.r)
  const snapshot: EntrySnapshot = {
    version: compact.v,
    manifest: compact.m,
    graphSha: compact.g,
    tree: compact.t,
    rows,
    indexes: createEntrySnapshotIndexes(rows)
  }
  if (compact.s) snapshot.search = compact.s
  return snapshot
}

function compactEntryRows(rows: EntryRowStore): CompactEntryRows {
  return {
    v: rows.versions.map(compactVersionRow),
    l: rows.languages.map(compactLanguageRow),
    n: rows.nodes.map(compactNodeRow)
  }
}

function expandEntryRows(rows: CompactEntryRows): EntryRowStore {
  return {
    versions: rows.v.map(expandVersionRow),
    languages: rows.l.map(expandLanguageRow),
    nodes: rows.n.map(expandNodeRow)
  }
}

function compactVersionRow(row: EntryVersionRow): CompactEntryVersionRow {
  return [
    row.rowId,
    row.versionId,
    row.nodeId,
    row.languageId,
    row.id,
    row.type,
    row.index,
    row.title,
    row.searchableText,
    row.seeded,
    row.rowHash,
    row.fileHash,
    row.data,
    row.status,
    row.locale,
    row.workspace,
    row.root,
    row.path,
    row.parentDir,
    row.childrenDir,
    row.filePath,
    row.level
  ]
}

function expandVersionRow(row: CompactEntryVersionRow): EntryVersionRow {
  return {
    rowId: row[0],
    versionId: row[1],
    nodeId: row[2],
    languageId: row[3],
    id: row[4],
    type: row[5],
    index: row[6],
    title: row[7],
    searchableText: row[8],
    seeded: row[9],
    rowHash: row[10],
    fileHash: row[11],
    data: row[12],
    status: row[13],
    locale: row[14],
    workspace: row[15],
    root: row[16],
    path: row[17],
    parentDir: row[18],
    childrenDir: row[19],
    filePath: row[20],
    level: row[21]
  }
}

function compactLanguageRow(row: EntryLanguageRow): CompactEntryLanguageRow {
  return [
    row.languageId,
    row.nodeId,
    row.locale,
    row.parentDir,
    row.selfDir,
    row.activeRowId,
    row.mainRowId,
    row.inheritedStatus ?? null,
    row.url,
    row.path,
    row.seeded,
    row.versionRowIds
  ]
}

function expandLanguageRow(row: CompactEntryLanguageRow): EntryLanguageRow {
  return {
    languageId: row[0],
    nodeId: row[1],
    locale: row[2],
    parentDir: row[3],
    selfDir: row[4],
    activeRowId: row[5],
    mainRowId: row[6],
    inheritedStatus: row[7] ?? undefined,
    url: row[8],
    path: row[9],
    seeded: row[10],
    versionRowIds: row[11]
  }
}

function compactNodeRow(row: EntryNodeRow): CompactEntryNodeRow {
  return [
    row.nodeId,
    row.id,
    row.index,
    row.parentId,
    row.parents,
    row.workspace,
    row.root,
    row.type,
    row.level,
    row.languageIds,
    row.childNodeIds
  ]
}

function expandNodeRow(row: CompactEntryNodeRow): EntryNodeRow {
  return {
    nodeId: row[0],
    id: row[1],
    index: row[2],
    parentId: row[3],
    parents: row[4],
    workspace: row[5],
    root: row[6],
    type: row[7],
    level: row[8],
    languageIds: row[9],
    childNodeIds: row[10]
  }
}
