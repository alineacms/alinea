import type {EntryStatus} from 'alinea/core/Entry'
import type {EntryGraph} from '../EntryIndex.js'
import {getEntryStore, type EntryStore} from './EntryStore.js'

type RowIdSet = Set<number>

export class EntryIndices {
  readonly store: EntryStore
  readonly byId = new Map<string, Array<number>>()
  readonly byNodeId = new Map<string, Array<number>>()
  readonly byParentNodeId = new Map<string, Array<number>>()
  readonly byType = new Map<string, RowIdSet>()
  readonly byWorkspace = new Map<string, RowIdSet>()
  readonly byRoot = new Map<string, RowIdSet>()
  readonly byLocale = new Map<string | null, RowIdSet>()
  readonly byStatus = new Map<EntryStatus, RowIdSet>()

  constructor(store: EntryStore) {
    this.store = store
    for (const row of store.rows) {
      const {rowId, nodeId, parentId, entry} = row
      addArrayMap(this.byId, entry.id, rowId)
      addArrayMap(this.byNodeId, nodeId, rowId)
      if (parentId) addArrayMap(this.byParentNodeId, parentId, rowId)
      addSetMap(this.byType, entry.type, rowId)
      addSetMap(this.byWorkspace, entry.workspace, rowId)
      addSetMap(this.byRoot, entry.root, rowId)
      addSetMap(this.byLocale, entry.locale, rowId)
      addSetMap(this.byStatus, entry.status, rowId)
    }
  }
}

const indicesCache = new WeakMap<EntryGraph, EntryIndices>()

export function getEntryIndices(graph: EntryGraph) {
  const cached = indicesCache.get(graph)
  if (cached) return cached
  const indices = new EntryIndices(getEntryStore(graph))
  indicesCache.set(graph, indices)
  return indices
}

function addArrayMap<K>(map: Map<K, Array<number>>, key: K, rowId: number) {
  const list = map.get(key)
  if (list) list.push(rowId)
  else map.set(key, [rowId])
}

function addSetMap<K>(map: Map<K, RowIdSet>, key: K, rowId: number) {
  const set = map.get(key)
  if (set) set.add(rowId)
  else map.set(key, new Set([rowId]))
}
