import {rxbEncode, rxbOpen} from '@creationix/rx'
import type {Config} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import {getRoot, getWorkspace} from '../Internal.js'
import {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import type {EntryIndex} from '../db/EntryIndex.js'
import type {FlatTree, ReadonlyTree} from '../source/Tree.js'
import {entries} from '../util/Objects.js'

export const RXB_ENTRY_ARTIFACT_VERSION = 1
export const NULL_INDEX_VALUE = '<null>'

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
  manifest: RxbEntryManifest
  tree: FlatTree
  rowsById: Record<string, RxbEntryRow>
  columns: RxbEntryColumns
  indexes: RxbEntryIndexes
  fieldIndexes: RxbEntryFieldIndexes
}

export interface RxbEntryManifest {
  version: 1
  workspaces: Record<string, RxbEntryManifestWorkspace>
  types: Record<string, RxbEntryManifestType>
}

export interface RxbEntryManifestWorkspace {
  roots: Record<string, RxbEntryManifestRoot>
  mediaDir?: string
}

export interface RxbEntryManifestRoot {
  i18n?: RxbEntryManifestI18n
  contains?: Array<string>
}

export interface RxbEntryManifestI18n {
  locales: Array<string>
}

export interface RxbEntryManifestType {
  contains?: Array<string>
  sharedFields: Array<string>
  searchFields?: Array<string>
  insertOrder?: 'first' | 'last' | 'free'
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

export type RxbEntryColumnName = Exclude<keyof RxbEntryRow, 'data'>

export type RxbEntryColumnArrays = {
  [Name in RxbEntryColumnName]: Array<RxbEntryRow[Name]>
}

export interface RxbEntryColumns {
  rowIds: Array<string>
  ordinalByRowId: Record<string, number>
  values: RxbEntryColumnArrays
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

interface RxbEntryLanguage {
  languageId: string
  nodeId: string
  locale: string | null
  parentDir: string
  selfDir: string
  activeRowId: string
  mainRowId: string
  inheritedStatus?: EntryStatus
  url: string
  path: string
  seeded: string | null
  versionRowIds: Array<string>
}

interface RxbEntryNode {
  nodeId: string
  id: string
  index: string
  parentId: string | null
  parents: Array<string>
  workspace: string
  root: string
  type: string
  level: number
  languageIds: Array<string>
  childNodeIds: Array<string>
}

interface RxbEntryVersion {
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

export function createRxbEntryArtifact(
  config: Config,
  index: EntryIndex,
  options: CreateRxbEntryArtifactOptions = {},
  tree: ReadonlyTree = index.tree
): RxbEntryArtifact {
  const manifest = createRxbEntryManifest(config)
  const entries = Array.from(index.filter({}))
  const versions = entries.map(createVersion)
  const languages = createLanguages(entries)
  const nodes = createNodes(index, entries)
  const rowsById = createRowsById(versions, languages, nodes)

  return {
    meta: {
      kind: 'alinea.entry-engine.rxb',
      version: RXB_ENTRY_ARTIFACT_VERSION,
      configHash: options.configHash ?? manifest.version.toString(),
      graphSha: index.sha,
      contentHash: options.contentHash ?? index.sha,
      createdAt: options.createdAt ?? new Date(0).toISOString()
    },
    payload: {
      manifest,
      tree: tree.flat(),
      rowsById,
      columns: createRxbEntryColumns(Object.values(rowsById)),
      indexes: createRxbEntryIndexes(rowsById, languages, nodes),
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

export function indexKey(name: string, value: string | null): string {
  return `${name}:${indexValue(value)}`
}

export function indexValue(value: string | null | undefined): string {
  return value ?? NULL_INDEX_VALUE
}

export function rxbIndexValue(value: string | number | boolean | null): string {
  return value === null ? indexValue(null) : String(value)
}

function createRowsById(
  versions: Array<RxbEntryVersion>,
  languageRows: Array<RxbEntryLanguage>,
  nodeRows: Array<RxbEntryNode>
): Record<string, RxbEntryRow> {
  const rowsById: Record<string, RxbEntryRow> = {}
  const languages = new Map(
    languageRows.map(language => [language.languageId, language])
  )
  const nodes = new Map(nodeRows.map(node => [node.nodeId, node]))

  for (const version of versions) {
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
  return rowsById
}

function createRxbEntryIndexes(
  rowsById: Record<string, RxbEntryRow>,
  languages: Array<RxbEntryLanguage>,
  nodes: Array<RxbEntryNode>
): RxbEntryIndexes {
  const indexes = emptyRxbEntryIndexes()
  const rowIdsByNode = new Map<string, Array<string>>()

  for (const row of Object.values(rowsById)) {
    appendIndex(indexes.byId, row.id, row.rowId)
    appendIndex(indexes.byPath, row.path, row.rowId)
    appendIndex(indexes.byLevel, String(row.level), row.rowId)
    appendIndex(indexes.byType, row.type, row.rowId)
    appendIndex(indexes.byWorkspace, row.workspace, row.rowId)
    appendIndex(indexes.byRoot, row.root, row.rowId)
    appendIndex(indexes.byLocale, indexValue(row.locale), row.rowId)
    appendIndex(indexes.byStatus, row.status, row.rowId)
    appendIndex(indexes.byUrl, row.url, row.rowId)
    indexes.byFilePath[row.filePath] = row.rowId
    if (row.active) indexes.byActive.push(row.rowId)
    if (row.main) indexes.byMain.push(row.rowId)

    const nodeRows = rowIdsByNode.get(row.nodeId) ?? []
    nodeRows.push(row.rowId)
    rowIdsByNode.set(row.nodeId, nodeRows)
  }

  for (const [nodeId, rowIds] of rowIdsByNode) indexes.byNode[nodeId] = rowIds
  for (const node of nodes) {
    appendValues(
      indexes.byParent,
      indexValue(node.parentId),
      rowIdsByNode.get(node.nodeId) ?? []
    )
  }
  for (const language of languages) indexes.byDir[language.selfDir] = language.nodeId
  return indexes
}

function emptyRxbEntryIndexes(): RxbEntryIndexes {
  return {
    byId: {},
    byNode: {},
    byFilePath: {},
    byDir: {},
    byParent: {},
    byPath: {},
    byUrl: {},
    byLevel: {},
    byType: {},
    byWorkspace: {},
    byRoot: {},
    byLocale: {},
    byStatus: {},
    byActive: [],
    byMain: []
  }
}

export function createRxbEntryColumns(rows: Array<RxbEntryRow>): RxbEntryColumns {
  const rowIds = Array<string>()
  const ordinalByRowId: Record<string, number> = {}
  const values: RxbEntryColumnArrays = {
    rowId: [],
    versionId: [],
    nodeId: [],
    languageId: [],
    id: [],
    type: [],
    index: [],
    title: [],
    searchableText: [],
    seeded: [],
    rowHash: [],
    fileHash: [],
    versionStatus: [],
    status: [],
    locale: [],
    workspace: [],
    root: [],
    path: [],
    parentDir: [],
    childrenDir: [],
    filePath: [],
    level: [],
    parentId: [],
    parents: [],
    url: [],
    active: [],
    main: []
  }
  for (const row of rows) {
    const ordinal = rowIds.length
    rowIds.push(row.rowId)
    ordinalByRowId[row.rowId] = ordinal
    values.rowId.push(row.rowId)
    values.versionId.push(row.versionId)
    values.nodeId.push(row.nodeId)
    values.languageId.push(row.languageId)
    values.id.push(row.id)
    values.type.push(row.type)
    values.index.push(row.index)
    values.title.push(row.title)
    values.searchableText.push(row.searchableText)
    values.seeded.push(row.seeded)
    values.rowHash.push(row.rowHash)
    values.fileHash.push(row.fileHash)
    values.versionStatus.push(row.versionStatus)
    values.status.push(row.status)
    values.locale.push(row.locale)
    values.workspace.push(row.workspace)
    values.root.push(row.root)
    values.path.push(row.path)
    values.parentDir.push(row.parentDir)
    values.childrenDir.push(row.childrenDir)
    values.filePath.push(row.filePath)
    values.level.push(row.level)
    values.parentId.push(row.parentId)
    values.parents.push(row.parents)
    values.url.push(row.url)
    values.active.push(row.active)
    values.main.push(row.main)
  }
  return {rowIds, ordinalByRowId, values}
}

function createRxbEntryManifest(config: Config): RxbEntryManifest {
  const typeNames = Schema.typeNames(config.schema)
  return {
    version: 1,
    workspaces: Object.fromEntries(
      entries(config.workspaces).map(([workspaceName, workspace]) => {
        const workspaceData = getWorkspace(workspace)
        return [
          workspaceName,
          {
            mediaDir: workspaceData.mediaDir,
            roots: Object.fromEntries(
              entries(workspace).map(([rootName, root]) => {
                const rootData = getRoot(root)
                return [
                  rootName,
                  {
                    i18n: rootData.i18n && {
                      locales: Array.from(rootData.i18n.locales)
                    },
                    contains: rootData.contains?.map(type =>
                      typeof type === 'string'
                        ? type
                        : (typeNames.get(type) ?? Type.label(type))
                    )
                  }
                ]
              })
            )
          }
        ]
      })
    ),
    types: Object.fromEntries(
      entries(config.schema).map(([typeName, type]) => {
        const shared = Type.sharedData(type, {}) ?? {}
        return [
          typeName,
          {
            contains: Type.contains(type).map(type =>
              typeof type === 'string'
                ? type
                : (typeNames.get(type) ?? Type.label(type))
            ),
            sharedFields: Object.keys(shared),
            insertOrder: Type.insertOrder(type)
          }
        ]
      })
    )
  }
}

function createVersion(entry: Entry): RxbEntryVersion {
  return {
    rowId: entry.filePath,
    versionId: entry.filePath,
    nodeId: entry.id,
    languageId: languageId(entry.id, entry.locale),
    id: entry.id,
    type: entry.type,
    index: entry.index,
    title: entry.title,
    searchableText: entry.searchableText,
    seeded: entry.seeded,
    rowHash: entry.rowHash,
    fileHash: entry.fileHash,
    data: entry.data,
    status: entry.status,
    locale: entry.locale,
    workspace: entry.workspace,
    root: entry.root,
    path: entry.path,
    parentDir: entry.parentDir,
    childrenDir: entry.childrenDir,
    filePath: entry.filePath,
    level: entry.level
  }
}

function createLanguages(entries: Array<Entry>): Array<RxbEntryLanguage> {
  const byLanguage = new Map<string, Array<Entry>>()
  for (const entry of entries) {
    const key = languageId(entry.id, entry.locale)
    const rows = byLanguage.get(key) ?? []
    rows.push(entry)
    byLanguage.set(key, rows)
  }
  return Array.from(byLanguage, ([id, rows]) => {
    const first = rows[0]
    const active = rows.find(row => row.active) ?? first
    const main = rows.find(row => row.main) ?? active
    return {
      languageId: id,
      nodeId: first.id,
      locale: first.locale,
      parentDir: first.parentDir,
      selfDir: first.childrenDir,
      activeRowId: active.filePath,
      mainRowId: main.filePath,
      url: main.url,
      path: main.path,
      seeded: main.seeded,
      versionRowIds: rows.map(row => row.filePath)
    }
  })
}

function createNodes(index: EntryIndex, entries: Array<Entry>): Array<RxbEntryNode> {
  const byNode = new Map<string, Entry>()
  const languageIdsByNode = new Map<string, Set<string>>()
  for (const entry of entries) {
    if (!byNode.has(entry.id)) byNode.set(entry.id, entry)
    let languageIds = languageIdsByNode.get(entry.id)
    if (!languageIds) {
      languageIds = new Set()
      languageIdsByNode.set(entry.id, languageIds)
    }
    languageIds.add(languageId(entry.id, entry.locale))
  }
  return Array.from(byNode, ([id, entry]) => {
    const node = index.byId(id)
    return {
      nodeId: id,
      id,
      index: entry.index,
      parentId: entry.parentId,
      parents: entry.parents,
      workspace: entry.workspace,
      root: entry.root,
      type: entry.type,
      level: entry.level,
      languageIds: Array.from(languageIdsByNode.get(id) ?? []),
      childNodeIds: node ? Array.from(node.children(), child => child.id) : []
    }
  })
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

function appendIndex(
  target: Record<string, Array<string>>,
  key: string,
  value: string
) {
  const values = target[key] ?? []
  values.push(value)
  target[key] = values
}

function appendValues(
  target: Record<string, Array<string>>,
  key: string,
  values: Array<string>
) {
  if (values.length === 0) return
  const current = target[key] ?? []
  current.push(...values)
  target[key] = current
}

function languageId(id: string, locale: string | null): string {
  return `${id}:${locale ?? '<null>'}`
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
