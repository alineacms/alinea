import type {EntrySnapshotIndexes} from './EntrySnapshot.js'
import type {EntryNodeId, EntryRowId, EntryRowStore} from './EntryRows.js'

export const NULL_INDEX_VALUE = '<null>'

export function createEntrySnapshotIndexes(
  rows: EntryRowStore
): EntrySnapshotIndexes {
  const indexes = emptyEntrySnapshotIndexes()
  const rowIdsByNode = new Map<EntryNodeId, Array<EntryRowId>>()

  for (const version of rows.versions) {
    appendIndex(indexes.byId, version.id, version.rowId)
    appendIndex(indexes.byType, version.type, version.rowId)
    appendIndex(indexes.byWorkspace, version.workspace, version.rowId)
    appendIndex(indexes.byRoot, version.root, version.rowId)
    appendIndex(indexes.byLocale, indexValue(version.locale), version.rowId)
    appendIndex(indexes.byStatus, version.status, version.rowId)
    indexes.byFilePath[version.filePath] = version.rowId

    const nodeRows = rowIdsByNode.get(version.nodeId) ?? []
    nodeRows.push(version.rowId)
    rowIdsByNode.set(version.nodeId, nodeRows)
  }

  for (const node of rows.nodes) {
    appendValues(
      indexes.byParent,
      indexValue(node.parentId),
      rowIdsByNode.get(node.nodeId) ?? []
    )
  }

  for (const language of rows.languages) {
    indexes.byDir[language.selfDir] = language.nodeId
  }

  return indexes
}

export function emptyEntrySnapshotIndexes(): EntrySnapshotIndexes {
  return {
    byId: {},
    byFilePath: {},
    byDir: {},
    byParent: {},
    byType: {},
    byWorkspace: {},
    byRoot: {},
    byLocale: {},
    byStatus: {}
  }
}

export function indexKey(name: string, value: string | null): string {
  return `${name}:${indexValue(value)}`
}

export function indexValue(value: string | null | undefined): string {
  return value ?? NULL_INDEX_VALUE
}

function appendIndex(
  target: Record<string, Array<EntryRowId>>,
  key: string,
  value: EntryRowId
) {
  const values = target[key] ?? []
  values.push(value)
  target[key] = values
}

function appendValues(
  target: Record<string, Array<EntryRowId>>,
  key: string,
  values: Array<EntryRowId>
) {
  if (values.length === 0) return
  const current = target[key] ?? []
  current.push(...values)
  target[key] = current
}
