import type {Entry} from 'alinea/core/Entry'
import type {EntryCondition} from '../EntryIndex.js'
import type {EntryIndices} from './EntryIndices.js'

export interface QueryPlan {
  rowIds?: Array<number>
  search?: string
  entry(entry: Entry): boolean
}

export interface PlanInput {
  ids?: Array<string>
  search?: string
  preFilter?: EntryCondition
  entry(entry: Entry): boolean
}

export class QueryPlanner {
  plan(indices: EntryIndices, input: PlanInput): QueryPlan {
    const directRows = input.ids
      ? collectRowsByIds(indices, input.ids)
      : undefined
    const preRows = input.preFilter?.nodes && directRows
      ? collectRowsFromNodes(indices, input.preFilter.nodes as any, input.preFilter)
      : undefined
    const rowIds = intersectRows(directRows, preRows)
    const pre = input.preFilter
    return {
      rowIds,
      search: input.search,
      entry(entry: Entry) {
        if (pre?.entry && !pre.entry(entry)) return false
        return input.entry(entry)
      }
    }
  }
}

function collectRowsByIds(indices: EntryIndices, ids: Array<string>) {
  const dedupe = new Set<number>()
  const rows = Array<number>()
  for (const id of ids) {
    const matches = indices.byId.get(id)
    if (!matches) continue
    for (const rowId of matches) {
      if (dedupe.has(rowId)) continue
      dedupe.add(rowId)
      rows.push(rowId)
    }
  }
  return rows
}

function intersectRows(
  a: Array<number> | undefined,
  b: Array<number> | undefined
) {
  if (a && b) {
    const bSet = new Set(b)
    return a.filter(rowId => bSet.has(rowId))
  }
  return a ?? b
}

function collectRowsFromNodes(
  indices: EntryIndices,
  nodes: Iterable<{id: string; get(locale: string | null): unknown}>,
  preFilter: NonNullable<PlanInput['preFilter']>
) {
  const dedupe = new Set<number>()
  const rows = Array<number>()
  for (const node of nodes) {
    if (preFilter.node && !preFilter.node(node as any)) continue
    const nodeRows = indices.byNodeId.get(node.id)
    if (!nodeRows) continue
    for (const rowId of nodeRows) {
      const row = indices.store.byRowId[rowId]
      if (!row) continue
      if (preFilter.language) {
        const language = node.get(row.entry.locale)
        if (!language || !preFilter.language(language as any)) continue
      }
      if (dedupe.has(rowId)) continue
      dedupe.add(rowId)
      rows.push(rowId)
    }
  }
  return rows
}
