import type {Entry} from 'alinea/core/Entry'
import type {EntryGraph, EntryNode} from '../EntryIndex.js'

export interface EntryRow {
  rowId: number
  nodeId: string
  parentId: string | null
  entry: Entry
}

export class EntryStore {
  readonly rows: Array<EntryRow>
  readonly byRowId: Array<EntryRow>

  constructor(rows: Array<EntryRow>) {
    this.rows = rows
    this.byRowId = rows
  }
}

const storeCache = new WeakMap<EntryGraph, EntryStore>()

function rowsForNode(node: EntryNode, startRowId: number) {
  const rows = Array<EntryRow>()
  let rowId = startRowId
  for (const language of node.values()) {
    const lang = language as any
    for (const entry of lang.entries as Array<Entry>) {
      rows.push({
        rowId: rowId++,
        nodeId: node.id,
        parentId: node.parentId,
        entry
      })
    }
  }
  return rows
}

export function getEntryStore(graph: EntryGraph) {
  const cached = storeCache.get(graph)
  if (cached) return cached
  const rows = Array<EntryRow>()
  let rowId = 0
  for (const node of graph.nodes) {
    const nodeRows = rowsForNode(node, rowId)
    rows.push(...nodeRows)
    rowId += nodeRows.length
  }
  const store = new EntryStore(rows)
  storeCache.set(graph, store)
  return store
}
