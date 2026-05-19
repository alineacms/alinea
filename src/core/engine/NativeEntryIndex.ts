import {Config} from '../Config.js'
import type {EntryStatus} from '../Entry.js'
import {parseRecord} from '../EntryRecord.js'
import {getRoot} from '../Internal.js'
import type {ChangesBatch} from '../source/Change.js'
import type {Source} from '../source/Source.js'
import type {ReadonlyTree} from '../source/Tree.js'
import {Type} from '../Type.js'
import {entryInfo, entryUrl} from '../util/EntryFilenames.js'
import {keys} from '../util/Objects.js'
import {basename, dirname} from '../util/Paths.js'
import {Workspace} from '../Workspace.js'
import {type EntryManifest} from './EntryManifest.js'
import type {EntryQueryOptions, EntryQueryPlan} from './EntryPlanner.js'
import type {EntrySnapshot} from './EntrySnapshot.js'
import {createEntrySnapshotIndexes} from './EntrySnapshotIndex.js'
import {createEntryManifest} from './EntrySnapshotBuilder.js'
import {ENTRY_SNAPSHOT_VERSION} from './EntrySnapshot.js'
import type {
  EntryLanguageId,
  EntryLanguageRow,
  EntryNodeId,
  EntryNodeRow,
  EntryRowStore,
  EntryVersionRow
} from './EntryRows.js'
import {SnapshotEntryPlanner} from './SnapshotEntryPlanner.js'

export class NativeEntryIndex {
  readonly #config: Config
  readonly #manifest: EntryManifest
  #tree: ReadonlyTree | undefined
  #versions = new Map<string, EntryVersionRow>()
  #snapshot: EntrySnapshot | undefined
  #planner: SnapshotEntryPlanner | undefined
  #plannerSnapshot: EntrySnapshot | undefined

  constructor(config: Config) {
    this.#config = config
    this.#manifest = createEntryManifest(config)
  }

  get sha() {
    return this.#tree?.sha ?? ''
  }

  get snapshot() {
    if (this.#snapshot?.graphSha === this.sha) return this.#snapshot
    const rows = createEntryRowsFromVersions(this.#config, [
      ...this.#versions.values()
    ])
    return (this.#snapshot = {
      version: ENTRY_SNAPSHOT_VERSION,
      manifest: this.#manifest,
      graphSha: this.sha,
      tree: this.#tree?.flat() ?? {sha: this.sha, tree: []},
      rows,
      indexes: createEntrySnapshotIndexes(rows)
    })
  }

  get planner() {
    const snapshot = this.snapshot
    if (this.#planner && this.#plannerSnapshot === snapshot)
      return this.#planner
    this.#plannerSnapshot = snapshot
    return (this.#planner = new SnapshotEntryPlanner(snapshot))
  }

  query(plan: EntryQueryPlan, options?: EntryQueryOptions) {
    return this.planner.candidates(plan, options)
  }

  async syncWith(source: Source) {
    const tree = await source.getTree()
    const files = Array.from(tree.index(), ([path, sha]) => ({
      path,
      sha
    })).filter(file => file.path.endsWith('.json'))
    const blobs = new Map(
      await Array.fromAsync(source.getBlobs(files.map(file => file.sha)))
    )
    this.#versions = new Map(
      files.map(file => [
        file.path,
        parseVersionRow(this.#config, file.path, file.sha, blobs.get(file.sha)!)
      ])
    )
    this.#tree = tree
    this.#invalidate()
    return tree.sha
  }

  async indexChanges(batch: ChangesBatch) {
    if (batch.fromSha !== this.sha)
      throw new Error(`Snapshot sha mismatch: ${batch.fromSha} <> ${this.sha}`)
    for (const change of batch.changes) {
      if (change.op === 'delete') {
        this.#versions.delete(change.path)
      } else {
        if (!change.path.endsWith('.json')) continue
        if (!change.contents)
          throw new Error(`Missing contents for ${change.path}`)
        this.#versions.set(
          change.path,
          parseVersionRow(
            this.#config,
            change.path,
            change.sha,
            change.contents
          )
        )
      }
    }
    this.#tree = this.#tree && (await this.#tree.withChanges(batch))
    this.#invalidate()
    return this.sha
  }

  #invalidate() {
    this.#snapshot = undefined
    this.#planner = undefined
    this.#plannerSnapshot = undefined
  }
}

function parseVersionRow(
  config: Config,
  filePath: string,
  sha: string,
  blob: Uint8Array
): EntryVersionRow {
  const text = new TextDecoder().decode(blob)
  const raw = JSON.parse(text)
  const {meta, data: recordData} = parseRecord(raw)
  const entryType = config.schema[meta.type]
  const segments = filePath.split('/')
  const fileName = basename(filePath, '.json')
  const [path, status] = entryInfo(fileName)
  const parentDir = dirname(filePath)
  const childrenDir = `${parentDir}/${path}`
  const data: Record<string, unknown> = {path, ...recordData}
  const singleWorkspace = Config.multipleWorkspaces(config)
    ? undefined
    : keys(config.workspaces)[0]
  let segmentIndex = 0
  const workspace = singleWorkspace ?? segments[segmentIndex++]
  const workspaceConfig = config.workspaces[workspace]
  if (!workspaceConfig) throw new Error(`Invalid workspace: ${workspace}`)
  const root = segments[segmentIndex++]
  const rootConfig = Workspace.roots(workspaceConfig)[root]
  if (!rootConfig) throw new Error(`Invalid root: ${root}`)
  const i18n = getRoot(rootConfig).i18n
  let locale: string | null = null
  if (i18n) {
    locale = segments[segmentIndex++].toLowerCase()
    const configured = i18n.locales.find(
      candidate => candidate.toLowerCase() === locale
    )
    if (!configured) throw new Error(`Invalid locale: ${locale}`)
    locale = configured
  }
  let levelOffset = 1
  if (!singleWorkspace) levelOffset += 1
  if (i18n) levelOffset += 1
  const level = segments.length - levelOffset - 1
  return {
    rowId: filePath,
    versionId: filePath,
    nodeId: meta.id,
    languageId: languageId(meta.id, locale),
    id: meta.id,
    type: meta.type,
    index: meta.index,
    title: data.title as string,
    searchableText: Type.searchableText(entryType, recordData),
    seeded: meta.seeded ?? null,
    rowHash: sha,
    fileHash: sha,
    data,
    status,
    locale,
    workspace,
    root,
    path,
    parentDir,
    childrenDir,
    filePath,
    level
  }
}

function createEntryRowsFromVersions(
  config: Config,
  versions: Array<EntryVersionRow>
): EntryRowStore {
  const languages = createLanguageRows(config, versions)
  const nodes = createNodeRows(versions)
  return {versions, languages, nodes}
}

function createLanguageRows(
  config: Config,
  versions: Array<EntryVersionRow>
): Array<EntryLanguageRow> {
  const byLanguage = new Map<EntryLanguageId, Array<EntryVersionRow>>()
  for (const version of versions) {
    const rows = byLanguage.get(version.languageId) ?? []
    rows.push(version)
    byLanguage.set(version.languageId, rows)
  }
  const parentIdByNode = parentIds(versions)
  const rowById = new Map<EntryLanguageId, EntryLanguageRow>()

  const build = (id: EntryLanguageId): EntryLanguageRow => {
    const cached = rowById.get(id)
    if (cached) return cached
    const rows = byLanguage.get(id)
    if (!rows) throw new Error(`Missing language rows for ${id}`)
    const first = rows[0]
    const active =
      rows.find(row => row.status === 'draft') ??
      rows.find(row => row.status === 'published') ??
      rows.find(row => row.status === 'archived') ??
      first
    const parentId = parentIdByNode.get(first.nodeId)
    const parent =
      parentId && byLanguage.has(languageId(parentId, first.locale))
        ? build(languageId(parentId, first.locale))
        : undefined
    const inheritedStatus =
      parent?.inheritedStatus ??
      (rows.some(row => row.status === 'archived')
        ? 'archived'
        : rows.some(row => row.status === 'draft') &&
            !rows.some(row => row.status === 'published')
          ? 'draft'
          : undefined)
    const main = inheritedStatus
      ? active
      : (rows.find(row => row.status === 'published') ??
        rows.find(row => row.status === 'archived') ??
        rows.find(row => row.status === 'draft') ??
        active)
    const parentPaths = parent
      ? parentPathRows(parent, rowById, parentIdByNode)
      : []
    const row: EntryLanguageRow = {
      languageId: id,
      nodeId: first.nodeId,
      locale: first.locale,
      parentDir: first.parentDir,
      selfDir: first.childrenDir,
      activeRowId: active.rowId,
      mainRowId: main.rowId,
      inheritedStatus,
      url: entryUrl(config.schema[main.type], {
        status: main.status,
        path: main.path,
        parentPaths,
        locale: main.locale,
        workspace: main.workspace,
        root: main.root
      }),
      path: main.path,
      seeded: main.seeded,
      versionRowIds: rows.map(row => row.rowId)
    }
    rowById.set(id, row)
    return row
  }

  return Array.from(byLanguage.keys(), build)
}

function parentPathRows(
  parent: EntryLanguageRow,
  languages: Map<EntryLanguageId, EntryLanguageRow>,
  parentIdByNode: Map<EntryNodeId, EntryNodeId | null>
) {
  const paths = Array<string>()
  let current: EntryLanguageRow | undefined = parent
  while (current) {
    paths.unshift(current.path)
    const nextParentId = parentIdByNode.get(current.nodeId)
    current =
      nextParentId === null || nextParentId === undefined
        ? undefined
        : languages.get(languageId(nextParentId, current.locale))
  }
  return paths
}

function createNodeRows(versions: Array<EntryVersionRow>): Array<EntryNodeRow> {
  const byNode = new Map<EntryNodeId, EntryVersionRow>()
  const languageIdsByNode = new Map<EntryNodeId, Set<EntryLanguageId>>()
  const parentIdByNode = parentIds(versions)
  const childrenByNode = new Map<EntryNodeId, Array<EntryNodeId>>()
  for (const [nodeId, parentId] of parentIdByNode) {
    if (!parentId) continue
    const children = childrenByNode.get(parentId) ?? []
    children.push(nodeId)
    childrenByNode.set(parentId, children)
  }
  for (const version of versions) {
    if (!byNode.has(version.nodeId)) byNode.set(version.nodeId, version)
    const ids = languageIdsByNode.get(version.nodeId) ?? new Set()
    ids.add(version.languageId)
    languageIdsByNode.set(version.nodeId, ids)
  }
  return Array.from(byNode, ([nodeId, first]) => ({
    nodeId,
    id: first.id,
    index: first.index,
    parentId: parentIdByNode.get(nodeId) ?? null,
    parents: parentsOf(nodeId, parentIdByNode),
    workspace: first.workspace,
    root: first.root,
    type: first.type,
    level: first.level,
    languageIds: Array.from(languageIdsByNode.get(nodeId) ?? []),
    childNodeIds: childrenByNode.get(nodeId) ?? []
  }))
}

function parentIds(versions: Array<EntryVersionRow>) {
  const byDir = new Map<string, EntryNodeId>()
  for (const version of versions) byDir.set(version.childrenDir, version.nodeId)
  const result = new Map<EntryNodeId, EntryNodeId | null>()
  for (const version of versions) {
    if (result.has(version.nodeId)) continue
    result.set(version.nodeId, byDir.get(version.parentDir) ?? null)
  }
  return result
}

function parentsOf(
  nodeId: EntryNodeId,
  parentIdByNode: Map<EntryNodeId, EntryNodeId | null>
) {
  const parents = Array<EntryNodeId>()
  let current = parentIdByNode.get(nodeId)
  while (current) {
    parents.unshift(current)
    current = parentIdByNode.get(current)
  }
  return parents
}

function languageId(id: string, locale: string | null): EntryLanguageId {
  return `${id}:${locale ?? '<null>'}`
}
