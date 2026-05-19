import {Config} from '../Config.js'
import type {Entry} from '../Entry.js'
import {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import type {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import {getRoot, getWorkspace} from '../Internal.js'
import type {ReadonlyTree} from '../source/Tree.js'
import {entries} from '../util/Objects.js'
import {createEntrySnapshotIndexes} from './EntrySnapshotIndex.js'
import {ENTRY_SNAPSHOT_VERSION, type EntrySnapshot} from './EntrySnapshot.js'
import type {
  EntryLanguageRow,
  EntryNodeId,
  EntryNodeRow,
  EntryRowStore,
  EntryVersionRow
} from './EntryRows.js'
import type {EntryManifest} from './EntryManifest.js'

export function createEntrySnapshot(
  config: Config,
  index: BaseEntryIndex,
  tree: ReadonlyTree = index.tree
): EntrySnapshot {
  const rows = createEntryRows(index)
  return {
    version: ENTRY_SNAPSHOT_VERSION,
    manifest: createEntryManifest(config),
    graphSha: index.sha,
    tree: tree.flat(),
    rows,
    indexes: createEntrySnapshotIndexes(rows)
  }
}

export function createEntryRows(index: BaseEntryIndex): EntryRowStore {
  const entries = Array.from(index.filter({}))
  const versions = entries.map(createVersionRow)
  const languages = createLanguageRows(entries)
  const nodes = createNodeRows(index, entries)
  return {versions, languages, nodes}
}

export function createEntryManifest(config: Config): EntryManifest {
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

function createVersionRow(entry: Entry): EntryVersionRow {
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

function createLanguageRows(entries: Array<Entry>): Array<EntryLanguageRow> {
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

function createNodeRows(
  index: BaseEntryIndex,
  entries: Array<Entry>
): Array<EntryNodeRow> {
  const byNode = new Map<EntryNodeId, Entry>()
  const languageIdsByNode = new Map<EntryNodeId, Set<string>>()
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

function languageId(id: string, locale: string | null): string {
  return `${id}:${locale ?? '<null>'}`
}
