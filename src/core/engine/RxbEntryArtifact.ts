import {rxbEncode, rxbOpen} from '@creationix/rx'
import * as base64 from 'alinea/core/util/BufferToBase64'
import {Config as ConfigUtils, type Config} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import {getRoot} from '../Internal.js'
import type {EntryIndex} from '../db/EntryIndex.js'
import type {FlatTree, ReadonlyTree} from '../source/Tree.js'

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
  data: Array<Record<string, unknown>>
  columns: RxbEntryColumns
  indexes: RxbEntryIndexes
  fieldIndexes: RxbEntryFieldIndexes
}

export interface RxbEntryManifest {
  version: 1
}

export interface RxbEntryIndexes {
  byId: Record<string, Array<number>>
  byNode: Record<string, Array<number>>
  byFilePath: Record<string, number>
  byDir: Record<string, string>
  byParent: Record<string, Array<number>>
  byPath: Record<string, Array<number>>
  byUrl: Record<string, Array<number>>
  byLevel: Record<string, Array<number>>
  byType: Record<string, Array<number>>
  byWorkspace: Record<string, Array<number>>
  byRoot: Record<string, Array<number>>
  byLocale: Record<string, Array<number>>
  byStatus: Record<string, Array<number>>
  byActive: Array<number>
  byMain: Array<number>
}

export interface RxbEntryFieldIndexes {
  exact: Record<string, Record<string, Array<number>>>
  number: Record<string, Array<[number, number]>>
}

export const rxbEntryColumnNames = [
  'id',
  'type',
  'index',
  'seeded',
  'parentId',
  'parents',
  'url',
  'active',
  'main'
] as const

export type RxbEntryColumnName = (typeof rxbEntryColumnNames)[number]

export type RxbEntryColumnArrays = {
  [Name in RxbEntryColumnName]: Array<RxbEntryRow[Name]>
}

export interface RxbEntryColumns {
  rowIds: Array<string>
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
  exactFieldIndexLimit?: number
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
  const rows = Object.values(createRowsById(versions, languages, nodes))

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
      data: createRxbEntryData(rows),
      columns: createRxbEntryColumns(rows),
      indexes: createRxbEntryIndexes(rows),
      fieldIndexes: createRxbEntryFieldIndexes(
        rows,
        options.exactFieldIndexLimit
      )
    }
  }
}

export function encodeRxbEntryArtifact(artifact: RxbEntryArtifact): Uint8Array {
  return rxbEncode(artifact, {indexThreshold: 0})
}

export function decodeRxbEntryArtifact(buffer: Uint8Array): RxbEntryArtifact {
  return rxbOpen(buffer) as RxbEntryArtifact
}

export function compressRxbEntryBytes(bytes: Uint8Array): Promise<string> {
  return base64.encode(bytes)
}

export async function decompressRxbEntryBytes(
  encoded: string
): Promise<Uint8Array> {
  return new Uint8Array(await base64.decode(encoded))
}

export function encodeCompressedRxbEntryArtifact(
  artifact: RxbEntryArtifact
): Promise<string> {
  return compressRxbEntryBytes(encodeRxbEntryArtifact(artifact))
}

export async function decodeCompressedRxbEntryArtifact(
  encoded: string
): Promise<RxbEntryArtifact> {
  return decodeRxbEntryArtifact(await decompressRxbEntryBytes(encoded))
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

function createRxbEntryIndexes(rows: Array<RxbEntryRow>): RxbEntryIndexes {
  const indexes = emptyRxbEntryIndexes()

  rows.forEach((row, ordinal) => {
    appendIndex(indexes.byId, row.id, ordinal)
    appendIndex(indexes.byType, row.type, ordinal)
    appendIndex(indexes.byStatus, row.status, ordinal)
  })

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
  const values: RxbEntryColumnArrays = {
    id: [],
    type: [],
    index: [],
    seeded: [],
    parentId: [],
    parents: [],
    url: [],
    active: [],
    main: []
  }
  for (const row of rows) {
    rowIds.push(row.rowId)
    values.id.push(row.id)
    values.type.push(row.type)
    values.index.push(row.index)
    values.seeded.push(row.seeded)
    values.parentId.push(row.parentId)
    values.parents.push(row.parents)
    values.url.push(row.url)
    values.active.push(row.active)
    values.main.push(row.main)
  }
  return {rowIds, values}
}

export function createRxbEntryData(
  rows: Array<RxbEntryRow>
): Array<Record<string, unknown>> {
  return rows.map(row => row.data)
}

export function hydrateRxbEntryRowAt(
  config: Config,
  payload: RxbEntryPayload,
  ordinal: number,
  fileHash = ''
): RxbEntryRow | undefined {
  const rowId = payload.columns.rowIds[ordinal]
  if (rowId === undefined) return
  const values = payload.columns.values
  const info = rowInfoFromRowId(config, rowId)
  const id = values.id[ordinal]
  return {
    rowId,
    versionId: rowId,
    nodeId: id,
    languageId: languageId(id, info.locale),
    id,
    type: values.type[ordinal],
    index: values.index[ordinal],
    title: String((payload.data[ordinal] ?? {}).title ?? ''),
    searchableText: String((payload.data[ordinal] ?? {}).title ?? ''),
    seeded: values.seeded[ordinal],
    rowHash: fileHash,
    fileHash,
    data: payload.data[ordinal] ?? {},
    versionStatus: info.status,
    status: info.status,
    locale: info.locale,
    workspace: info.workspace,
    root: info.root,
    path: info.path,
    parentDir: info.parentDir,
    childrenDir: info.childrenDir,
    filePath: rowId,
    level: info.level,
    parentId: values.parentId[ordinal],
    parents: values.parents[ordinal],
    url: values.url[ordinal],
    active: values.active[ordinal],
    main: values.main[ordinal]
  }
}

function rowInfoFromRowId(config: Config, rowId: string) {
  const segments = rowId.split('/')
  const workspaces = Object.keys(config.workspaces)
  const singleWorkspace = ConfigUtils.multipleWorkspaces(config)
    ? undefined
    : workspaces[0]
  let segment = 0
  const workspace = singleWorkspace ?? segments[segment++] ?? ''
  const workspaceConfig = config.workspaces[workspace]
  const root = segments[segment++] ?? ''
  const rootConfig = workspaceConfig?.[root]
  const i18n = rootConfig && getRoot(rootConfig).i18n
  let locale: string | null = null
  if (i18n) {
    const localeSegment = segments[segment]?.toLowerCase()
    const matched = i18n.locales.find(
      candidate => candidate.toLowerCase() === localeSegment
    )
    if (matched) {
      locale = matched
      segment++
    }
  }
  const fileName = segments.at(-1) ?? ''
  const parentDir = segments.slice(0, -1).join('/')
  const baseName = fileName.endsWith('.json')
    ? fileName.slice(0, -'.json'.length)
    : fileName
  const {path, status} = entryInfoFromBaseName(baseName)
  return {
    workspace,
    root,
    locale,
    path,
    status,
    parentDir,
    childrenDir: parentDir ? `${parentDir}/${path}` : path,
    level: Math.max(0, segments.length - segment - 1)
  }
}

function entryInfoFromBaseName(baseName: string): {
  path: string
  status: EntryStatus
} {
  if (baseName.endsWith('.draft')) {
    return {path: baseName.slice(0, -'.draft'.length), status: 'draft'}
  }
  if (baseName.endsWith('.archived')) {
    return {path: baseName.slice(0, -'.archived'.length), status: 'archived'}
  }
  return {path: baseName, status: 'published'}
}

function createRxbEntryManifest(config: Config): RxbEntryManifest {
  void config
  return {version: 1}
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
  rows: Array<RxbEntryRow>,
  exactFieldIndexLimit = 256
): RxbEntryFieldIndexes {
  const exact: RxbEntryFieldIndexes['exact'] = {}
  const number: RxbEntryFieldIndexes['number'] = {}
  rows.forEach((row, ordinal) =>
    indexDataValue(row.data, '', ordinal, exact, number)
  )
  for (const values of Object.values(exact)) {
    for (const rows of Object.values(values)) rows.sort(compareOrdinals)
  }
  for (const rows of Object.values(number)) {
    rows.sort((a, b) => a[0] - b[0] || compareOrdinals(a[1], b[1]))
  }
  for (const [field, values] of Object.entries(exact)) {
    if (Object.keys(values).length > exactFieldIndexLimit) delete exact[field]
  }
  return {exact, number}
}

function indexDataValue(
  value: unknown,
  path: string,
  ordinal: number,
  exact: RxbEntryFieldIndexes['exact'],
  number: RxbEntryFieldIndexes['number']
) {
  if (!path) {
    if (!isRecord(value)) return
    for (const [key, child] of Object.entries(value)) {
      indexDataValue(child, key, ordinal, exact, number)
    }
    return
  }
  if (isPrimitiveIndexValue(value)) {
    if (typeof value !== 'number')
      addExact(exact, path, rxbIndexValue(value), ordinal)
    if (typeof value === 'number') (number[path] ??= []).push([value, ordinal])
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) indexDataValue(item, path, ordinal, exact, number)
    return
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      indexDataValue(child, `${path}.${key}`, ordinal, exact, number)
    }
  }
}

function addExact(
  exact: RxbEntryFieldIndexes['exact'],
  field: string,
  value: string,
  ordinal: number
) {
  const byValue = (exact[field] ??= {})
  const rows = (byValue[value] ??= [])
  if (!rows.includes(ordinal)) rows.push(ordinal)
}

function appendIndex(
  target: Record<string, Array<number>>,
  key: string,
  value: number
) {
  const values = target[key] ?? []
  values.push(value)
  target[key] = values
}

function languageId(id: string, locale: string | null): string {
  return `${id}:${locale ?? '<null>'}`
}

function compareOrdinals(a: number, b: number): number {
  return a - b
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
