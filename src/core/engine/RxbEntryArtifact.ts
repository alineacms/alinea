import {rxbEncode, rxbOpen} from '@creationix/rx'
import type {EntryStatus} from '../Entry.js'
import type {FlatTree} from '../source/Tree.js'
import {indexValue} from './EntrySnapshotIndex.js'
import type {EntryManifest} from './EntryManifest.js'
import type {EntrySnapshot} from './EntrySnapshot.js'

export const RXB_ENTRY_ARTIFACT_VERSION = 1

export interface RxbEntryArtifactMeta {
  kind: 'alinea.entry-engine.rxb'
  version: typeof RXB_ENTRY_ARTIFACT_VERSION
  configHash: string
  graphSha: string
  contentHash: string
  createdAt: string
}

export interface RxbEntryArtifact {
  meta: RxbEntryArtifactMeta
  payload: RxbEntryPayload
}

export interface RxbEntryPayload {
  manifest: EntryManifest
  tree: FlatTree
  rowsById: Record<string, RxbEntryRow>
  indexes: RxbEntryIndexes
  fieldIndexes: RxbEntryFieldIndexes
}

export interface RxbEntryIndexes {
  byId: Record<string, Array<string>>
  byNode: Record<string, Array<string>>
  byFilePath: Record<string, string>
  byDir: Record<string, string>
  byParent: Record<string, Array<string>>
  byPath: Record<string, Array<string>>
  byUrl: Record<string, Array<string>>
  byLevel: Record<string, Array<string>>
  byType: Record<string, Array<string>>
  byWorkspace: Record<string, Array<string>>
  byRoot: Record<string, Array<string>>
  byLocale: Record<string, Array<string>>
  byStatus: Record<string, Array<string>>
  byActive: Array<string>
  byMain: Array<string>
}

export interface RxbEntryFieldIndexes {
  exact: Record<string, Record<string, Array<string>>>
  number: Record<string, Array<[number, string]>>
}

export interface RxbEntryRow {
  rowId: string
  versionId: string
  nodeId: string
  languageId: string
  id: string
  type: string
  index: string
  title: string
  searchableText: string
  seeded: string | null
  rowHash: string
  fileHash: string
  data: Record<string, unknown>
  versionStatus: EntryStatus
  status: EntryStatus
  locale: string | null
  workspace: string
  root: string
  path: string
  parentDir: string
  childrenDir: string
  filePath: string
  level: number
  parentId: string | null
  parents: Array<string>
  url: string
  active: boolean
  main: boolean
}

export interface CreateRxbEntryArtifactOptions {
  configHash?: string
  contentHash?: string
  createdAt?: string
}

export function createRxbEntryArtifact(
  snapshot: EntrySnapshot,
  options: CreateRxbEntryArtifactOptions = {}
): RxbEntryArtifact {
  const rowsById: Record<string, RxbEntryRow> = {}
  const languages = new Map(
    snapshot.rows.languages.map(language => [language.languageId, language])
  )
  const nodes = new Map(snapshot.rows.nodes.map(node => [node.nodeId, node]))

  for (const version of snapshot.rows.versions) {
    const language = languages.get(version.languageId)
    const node = nodes.get(version.nodeId)
    if (!language || !node) continue
    rowsById[version.rowId] = {
      ...version,
      versionStatus: version.status,
      status: language.inheritedStatus ?? version.status,
      parentId: node.parentId,
      parents: node.parents,
      url: language.url,
      active: version.rowId === language.activeRowId,
      main: version.rowId === language.mainRowId
    }
  }

  return {
    meta: {
      kind: 'alinea.entry-engine.rxb',
      version: RXB_ENTRY_ARTIFACT_VERSION,
      configHash: options.configHash ?? snapshot.manifest.version.toString(),
      graphSha: snapshot.graphSha,
      contentHash: options.contentHash ?? snapshot.graphSha,
      createdAt: options.createdAt ?? new Date(0).toISOString()
    },
    payload: {
      manifest: snapshot.manifest,
      tree: snapshot.tree,
      rowsById,
      indexes: createRxbEntryIndexes(snapshot, rowsById),
      fieldIndexes: createRxbEntryFieldIndexes(Object.values(rowsById))
    }
  }
}

export function encodeRxbEntryArtifact(artifact: RxbEntryArtifact): Uint8Array {
  return rxbEncode(artifact, {indexThreshold: 0})
}

export function decodeRxbEntryArtifact(buffer: Uint8Array): RxbEntryArtifact {
  return rxbOpen(buffer) as RxbEntryArtifact
}

function createRxbEntryIndexes(
  snapshot: EntrySnapshot,
  _rowsById: Record<string, RxbEntryRow>
): RxbEntryIndexes {
  const languages = new Map(
    snapshot.rows.languages.map(language => [language.languageId, language])
  )
  return {
    byId: snapshot.indexes.byId,
    byNode: mapRows(
      Object.fromEntries(
        snapshot.rows.nodes.map(node => [
          node.nodeId,
          node.languageIds.flatMap(languageId => {
            const language = languages.get(languageId)
            return language?.versionRowIds ?? []
          })
        ])
      )
    ),
    byFilePath: snapshot.indexes.byFilePath,
    byDir: snapshot.indexes.byDir,
    byParent: snapshot.indexes.byParent,
    byPath: snapshot.indexes.byPath,
    byUrl: snapshot.indexes.byUrl,
    byLevel: snapshot.indexes.byLevel,
    byType: snapshot.indexes.byType,
    byWorkspace: snapshot.indexes.byWorkspace,
    byRoot: snapshot.indexes.byRoot,
    byLocale: snapshot.indexes.byLocale,
    byStatus: snapshot.indexes.byStatus,
    byActive: snapshot.indexes.byActive,
    byMain: snapshot.indexes.byMain
  }
}

function createRxbEntryFieldIndexes(
  rows: Array<RxbEntryRow>
): RxbEntryFieldIndexes {
  const exact: RxbEntryFieldIndexes['exact'] = {}
  const number: RxbEntryFieldIndexes['number'] = {}
  for (const row of rows) {
    indexDataValue(row.data, '', row.rowId, exact, number)
  }
  for (const values of Object.values(exact)) {
    for (const rows of Object.values(values)) rows.sort(compareRowIds)
  }
  for (const rows of Object.values(number)) {
    rows.sort((a, b) => a[0] - b[0] || compareRowIds(a[1], b[1]))
  }
  return {exact, number}
}

function indexDataValue(
  value: unknown,
  path: string,
  rowId: string,
  exact: RxbEntryFieldIndexes['exact'],
  number: RxbEntryFieldIndexes['number']
) {
  if (!path) {
    if (!isRecord(value)) return
    for (const [key, child] of Object.entries(value)) {
      indexDataValue(child, key, rowId, exact, number)
    }
    return
  }
  if (isPrimitiveIndexValue(value)) {
    addExact(exact, path, rxbIndexValue(value), rowId)
    if (typeof value === 'number') (number[path] ??= []).push([value, rowId])
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) indexDataValue(item, path, rowId, exact, number)
    return
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      indexDataValue(child, `${path}.${key}`, rowId, exact, number)
    }
  }
}

function addExact(
  exact: RxbEntryFieldIndexes['exact'],
  field: string,
  value: string,
  rowId: string
) {
  const byValue = (exact[field] ??= {})
  const rows = (byValue[value] ??= [])
  if (!rows.includes(rowId)) rows.push(rowId)
}

function mapRows(
  index: Record<string, Array<string>>
): Record<string, Array<string>> {
  return Object.fromEntries(
    Object.entries(index).map(([key, rowIds]) => [key, Array.from(rowIds)])
  )
}

export function rxbIndexValue(value: string | number | boolean | null): string {
  return value === null ? indexValue(null) : String(value)
}

function compareRowIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function isPrimitiveIndexValue(
  value: unknown
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object')
}
