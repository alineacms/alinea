import {
  rxbEncode,
  rxbFindKey,
  rxbMakeCursor,
  rxbOpen,
  rxbRead,
  rxbSeekChild,
  type RxbCursor
} from '@creationix/rx'
import * as base64 from 'alinea/core/util/BufferToBase64'
import {Config as ConfigUtils, type Config} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import {parseRecord} from '../EntryRecord.js'
import {getRoot} from '../Internal.js'
import {Type} from '../Type.js'
import type {EntryIndex} from '../db/EntryIndex.js'
import type {FlatTree, ReadonlyTree} from '../source/Tree.js'
import {entryUrl} from '../util/EntryFilenames.js'

export const RXB_ENTRY_ARTIFACT_VERSION = 1
export const NULL_INDEX_VALUE = '<null>'
export const RXB_ENTRY_FLAG_ACTIVE = 1
export const RXB_ENTRY_FLAG_MAIN = 1 << 1
const RXB_ENTRY_STATUS_SHIFT = 2
const RXB_ENTRY_STATUS_MASK = 3 << RXB_ENTRY_STATUS_SHIFT

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
  byType: Record<string, Array<number>>
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
  'url'
] as const

export type RxbEntryColumnName = (typeof rxbEntryColumnNames)[number]

export type RxbEntryColumnArrays = {
  [Name in RxbEntryColumnName]: Array<RxbEntryRow[Name]>
}

export interface RxbEntryColumns {
  rowIds: Array<string>
  flags: Array<number>
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

export interface RxbEntryVersion {
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
  const entries = Array.from(index.filter({}))
  const versions = entries.map(createVersion)
  const rows = Object.values(
    createRowsById(versions, createLanguages(entries), createNodes(index, entries))
  )
  return createRxbEntryArtifactFromRows(config, tree, rows, {
    contentHash: index.sha,
    ...options
  })
}

export function createRxbEntryArtifactFromBlobs(
  config: Config,
  tree: ReadonlyTree,
  blobs: ReadonlyMap<string, Uint8Array>,
  options: CreateRxbEntryArtifactOptions = {}
): RxbEntryArtifact {
  return createRxbEntryArtifactFromVersions(
    config,
    tree,
    createVersionsFromBlobs(config, tree, blobs),
    options
  )
}

export function createRxbEntryArtifactFromRows(
  config: Config,
  tree: ReadonlyTree,
  rows: Array<RxbEntryRow>,
  options: CreateRxbEntryArtifactOptions = {}
): RxbEntryArtifact {
  return createRxbEntryArtifactFromVersions(
    config,
    tree,
    rows.map(row => createRxbEntryVersionFromRow(row)),
    options
  )
}

export function createRxbEntryArtifactFromVersions(
  config: Config,
  tree: ReadonlyTree,
  versions: Array<RxbEntryVersion>,
  options: CreateRxbEntryArtifactOptions = {}
): RxbEntryArtifact {
  const manifest = createRxbEntryManifest(config)
  const languages = createLanguagesFromVersions(config, versions)
  const nodes = createNodesFromVersions(config, versions)
  const rows = Object.values(createRowsById(versions, languages, nodes))

  return {
    meta: {
      kind: 'alinea.entry-engine.rxb',
      version: RXB_ENTRY_ARTIFACT_VERSION,
      configHash: options.configHash ?? manifest.version.toString(),
      graphSha: tree.sha,
      contentHash: options.contentHash ?? tree.sha,
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

export function createRxbEntryVersionFromBlob(
  config: Config,
  filePath: string,
  sha: string,
  blob: Uint8Array
): RxbEntryVersion {
  const info = rxbEntryInfoFromRowId(config, filePath)
  const record = JSON.parse(new TextDecoder().decode(blob))
  const {meta, data: recordData} = parseRecord(record)
  const data: Record<string, unknown> = {path: info.path, ...recordData}
  const type = meta.type
  const entryType = config.schema[type]
  return {
    rowId: filePath,
    versionId: filePath,
    nodeId: meta.id,
    languageId: languageId(meta.id, info.locale),
    id: meta.id,
    type,
    index: meta.index,
    title: String(data.title ?? ''),
    searchableText: entryType ? Type.searchableText(entryType, data) : '',
    seeded: meta.seeded ?? null,
    rowHash: sha,
    fileHash: sha,
    data,
    status: info.status,
    locale: info.locale,
    workspace: info.workspace,
    root: info.root,
    path: info.path,
    parentDir: info.parentDir,
    childrenDir: info.childrenDir,
    filePath,
    level: info.level
  }
}

export function encodeRxbEntryArtifact(artifact: RxbEntryArtifact): Uint8Array {
  return rxbEncode(artifact, {indexThreshold: 0})
}

export function decodeRxbEntryArtifact(buffer: Uint8Array): RxbEntryArtifact {
  const artifact = rxbOpen(buffer) as RxbEntryArtifact
  validateRxbEntryArtifact(artifact)
  return artifact
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

export function validateRxbEntryArtifact(
  artifact: RxbEntryArtifact
): asserts artifact is RxbEntryArtifact {
  if (artifact.meta?.kind !== 'alinea.entry-engine.rxb')
    throw new Error('Invalid RXB entry artifact: unsupported kind')
  if (artifact.meta.version !== RXB_ENTRY_ARTIFACT_VERSION)
    throw new Error(
      `Invalid RXB entry artifact: unsupported version ${artifact.meta.version}`
    )
  if (artifact.payload?.manifest?.version !== RXB_ENTRY_ARTIFACT_VERSION)
    throw new Error('Invalid RXB entry artifact: unsupported payload version')
  if (!Array.isArray(artifact.payload.columns?.rowIds))
    throw new Error('Invalid RXB entry artifact: missing row ids')
  if (!artifact.payload.columns?.flags)
    throw new Error('Invalid RXB entry artifact: missing flags')
  if (!artifact.payload.columns?.values)
    throw new Error('Invalid RXB entry artifact: missing columns')
  if (!Array.isArray(artifact.payload.data))
    throw new Error('Invalid RXB entry artifact: missing data rows')
  if (artifact.payload.columns.rowIds.length !== artifact.payload.data.length)
    throw new Error('Invalid RXB entry artifact: row/data length mismatch')
  if (artifact.payload.columns.rowIds.length !== artifact.payload.columns.flags.length)
    throw new Error('Invalid RXB entry artifact: row/flag length mismatch')
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
  })

  return indexes
}

function emptyRxbEntryIndexes(): RxbEntryIndexes {
  return {
    byId: {},
    byType: {}
  }
}

export function createRxbEntryColumns(rows: Array<RxbEntryRow>): RxbEntryColumns {
  const rowIds = Array<string>()
  const flags = Array<number>(rows.length)
  const values: RxbEntryColumnArrays = {
    id: [],
    type: [],
    index: [],
    seeded: [],
    parentId: [],
    parents: [],
    url: []
  }
  rows.forEach((row, ordinal) => {
    rowIds.push(row.rowId)
    flags[ordinal] = rxbEntryFlags(row)
    values.id.push(row.id)
    values.type.push(row.type)
    values.index.push(row.index)
    values.seeded.push(row.seeded)
    values.parentId.push(row.parentId)
    values.parents.push(row.parents)
    values.url.push(row.url)
  })
  return {rowIds, flags, values}
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
  const info = rxbEntryInfoFromRowId(config, rowId)
  const id = values.id[ordinal]
  const data = payload.data[ordinal] ?? {}
  const type = values.type[ordinal]
  const entryType = config.schema[type]
  const flags = payload.columns.flags[ordinal]
  const status = rxbEntryStatusFromFlags(flags)
  return {
    rowId,
    versionId: rowId,
    nodeId: id,
    languageId: languageId(id, info.locale),
    id,
    type,
    index: values.index[ordinal],
    title: String(data.title ?? ''),
    searchableText: entryType ? Type.searchableText(entryType, data) : '',
    seeded: values.seeded[ordinal],
    rowHash: fileHash,
    fileHash,
    data,
    versionStatus: status,
    status,
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
    active: rxbEntryIsActive(flags),
    main: rxbEntryIsMain(flags)
  }
}

export function rxbEntryFlags(row: Pick<RxbEntryRow, 'active' | 'main' | 'status'>): number {
  let flags = rxbStatusFlags(row.status)
  if (row.active) flags |= RXB_ENTRY_FLAG_ACTIVE
  if (row.main) flags |= RXB_ENTRY_FLAG_MAIN
  return flags
}

export function rxbEntryIsActive(flags: number): boolean {
  return Boolean(flags & RXB_ENTRY_FLAG_ACTIVE)
}

export function rxbEntryIsMain(flags: number): boolean {
  return Boolean(flags & RXB_ENTRY_FLAG_MAIN)
}

export function rxbEntryStatusFromFlags(flags: number): EntryStatus {
  switch (flags & RXB_ENTRY_STATUS_MASK) {
    case 1 << RXB_ENTRY_STATUS_SHIFT:
      return 'draft'
    case 2 << RXB_ENTRY_STATUS_SHIFT:
      return 'archived'
    default:
      return 'published'
  }
}

export class RxbEntryArtifactCursor {
  readonly #bytes: Uint8Array
  #flags: RxbCursor | undefined

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes
  }

  flagAt(ordinal: number): number | undefined {
    const flags = this.#flagsCursor()
    if (!flags || ordinal < 0 || ordinal >= flags.ixCount) return
    const child = rxbMakeCursor(this.#bytes)
    rxbSeekChild(child, flags, ordinal)
    const tag = rxbRead(child)
    return tag === 'int' ? child.val : undefined
  }

  #flagsCursor(): RxbCursor | undefined {
    if (this.#flags) return this.#flags
    const cursor = this.#findPath('payload', 'columns', 'flags')
    if (cursor?.tag === 'array') this.#flags = cursor
    return this.#flags
  }

  #findPath(...keys: Array<string>): RxbCursor | undefined {
    let current = rxbMakeCursor(this.#bytes)
    rxbRead(current)
    for (const key of keys) {
      const next = rxbMakeCursor(this.#bytes)
      if (!rxbFindKey(next, current, key)) return
      current = next
    }
    return current
  }
}

function rxbStatusFlags(status: EntryStatus): number {
  switch (status) {
    case 'draft':
      return 1 << RXB_ENTRY_STATUS_SHIFT
    case 'archived':
      return 2 << RXB_ENTRY_STATUS_SHIFT
    default:
      return 0
  }
}

export function rxbEntryInfoFromRowId(config: Config, rowId: string) {
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
  const status = fileStatus(entry)
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
    status,
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

function fileStatus(entry: Pick<Entry, 'filePath'>): EntryStatus {
  const fileName = entry.filePath.split('/').at(-1) ?? ''
  const baseName = fileName.endsWith('.json')
    ? fileName.slice(0, -'.json'.length)
    : fileName
  return entryInfoFromBaseName(baseName).status
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

function createLanguagesFromVersions(
  config: Config,
  versions: Array<RxbEntryVersion>
): Array<RxbEntryLanguage> {
  const byLanguage = new Map<string, Array<RxbEntryVersion>>()
  const byDir = new Map(versions.map(row => [row.childrenDir, row]))
  for (const version of versions) {
    const key = languageId(version.id, version.locale)
    const rows = byLanguage.get(key) ?? []
    rows.push(version)
    byLanguage.set(key, rows)
  }
  return Array.from(byLanguage, ([id, rows]) => {
    const first = rows[0]
    const active =
      rows.find(row => row.status === 'draft') ??
      rows.find(row => row.status === 'published') ??
      rows.find(row => row.status === 'archived') ??
      first
    const main =
      rows.find(row => row.status === 'published') ??
      rows.find(row => row.status === 'archived') ??
      rows.find(row => row.status === 'draft') ??
      active
    return {
      languageId: id,
      nodeId: first.id,
      locale: first.locale,
      parentDir: first.parentDir,
      selfDir: first.childrenDir,
      activeRowId: active.rowId,
      mainRowId: main.rowId,
      url: createVersionUrl(config, main, byDir),
      path: main.path,
      seeded: main.seeded,
      versionRowIds: rows.map(row => row.rowId)
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

function createNodesFromVersions(
  config: Config,
  versions: Array<RxbEntryVersion>
): Array<RxbEntryNode> {
  const byNode = new Map<string, Array<RxbEntryVersion>>()
  const byDir = new Map<string, string>()
  for (const version of versions) {
    const rows = byNode.get(version.id) ?? []
    rows.push(version)
    byNode.set(version.id, rows)
    byDir.set(version.childrenDir, version.id)
  }
  const nodes = new Map<string, RxbEntryNode>()
  const mkNode = (id: string): RxbEntryNode => {
    const cached = nodes.get(id)
    if (cached) return cached
    const rows = byNode.get(id)
    if (!rows) throw new Error(`Entry node not found: ${id}`)
    const first = rows[0]
    const parentId = byDir.get(first.parentDir) ?? null
    const parent = parentId ? mkNode(parentId) : undefined
    const languageIds = Array.from(
      new Set(rows.map(row => languageId(row.id, row.locale)))
    )
    const node: RxbEntryNode = {
      nodeId: id,
      id,
      index: first.index,
      parentId,
      parents: parent ? parent.parents.concat(parent.id) : [],
      workspace: first.workspace,
      root: first.root,
      type: first.type,
      level: first.level,
      languageIds,
      childNodeIds: []
    }
    nodes.set(id, node)
    return node
  }
  for (const id of byNode.keys()) mkNode(id)
  for (const node of nodes.values()) {
    if (!node.parentId) continue
    const parent = nodes.get(node.parentId)
    if (parent) parent.childNodeIds.push(node.id)
  }
  void config
  return Array.from(nodes.values()).sort((a, b) => a.index.localeCompare(b.index))
}

function createVersionsFromBlobs(
  config: Config,
  tree: ReadonlyTree,
  blobs: ReadonlyMap<string, Uint8Array>
): Array<RxbEntryVersion> {
  const versions = Array<RxbEntryVersion>()
  for (const [filePath, sha] of tree.index()) {
    const blob = blobs.get(sha)
    if (!blob) throw new Error(`Missing blob for ${filePath}: ${sha}`)
    versions.push(createRxbEntryVersionFromBlob(config, filePath, sha, blob))
  }
  return versions
}

export function createRxbEntryVersionFromRow(
  row: RxbEntryRow
): RxbEntryVersion {
  return {
    rowId: row.rowId,
    versionId: row.versionId,
    nodeId: row.nodeId,
    languageId: row.languageId,
    id: row.id,
    type: row.type,
    index: row.index,
    title: row.title,
    searchableText: row.searchableText,
    seeded: row.seeded,
    rowHash: row.rowHash,
    fileHash: row.fileHash,
    data: row.data,
    status: row.versionStatus,
    locale: row.locale,
    workspace: row.workspace,
    root: row.root,
    path: row.path,
    parentDir: row.parentDir,
    childrenDir: row.childrenDir,
    filePath: row.filePath,
    level: row.level
  }
}

function createVersionUrl(
  config: Config,
  version: RxbEntryVersion,
  byDir: ReadonlyMap<string, RxbEntryVersion>
): string {
  const entryType = config.schema[version.type]
  const parentPaths = Array<string>()
  let parent = byDir.get(version.parentDir)
  while (parent) {
    parentPaths.unshift(parent.path)
    parent = byDir.get(parent.parentDir)
  }
  return entryUrl(entryType, {
    status: version.status,
    path: version.path,
    parentPaths,
    locale: version.locale,
    workspace: version.workspace,
    root: version.root
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
