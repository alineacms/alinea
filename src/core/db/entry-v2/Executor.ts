import type {Entry} from 'alinea/core/Entry'
import type {EntryGraph, EntryCondition} from '../EntryIndex.js'
import type {EntryIndices} from './EntryIndices.js'
import type {QueryPlan} from './Planner.js'

export class QueryExecutor {
  *execute(
    graph: EntryGraph,
    indices: EntryIndices,
    plan: QueryPlan,
    preFilter?: EntryCondition
  ): Generator<Entry> {
    if (plan.search) {
      const filter: EntryCondition = {
        search: plan.search,
        nodes: preFilter?.nodes,
        node: preFilter?.node,
        language: preFilter?.language,
        entry: plan.entry
      }
      yield* graph.filter(filter)
      return
    }
    if (preFilter?.nodes) {
      for (const node of preFilter.nodes) {
        if (preFilter.node && !preFilter.node(node)) continue
        for (const language of node.values()) {
          if (preFilter.language && !preFilter.language(language as any)) continue
          const lang = language as any
          for (const entry of lang.entries as Array<Entry>) {
            if (!plan.entry(entry)) continue
            yield entry
          }
        }
      }
      return
    }
    const rowIds = plan.rowIds
    if (rowIds) {
      const preNodes = preFilter?.nodes
      const allowedNodes = preNodes
        ? new Map(Array.from(preNodes, node => [node.id, node] as const))
        : undefined
      const nodeCache = new Map<string, ReturnType<typeof graph.byId>>()
      const getNode = (nodeId: string) => {
        if (!nodeCache.has(nodeId)) nodeCache.set(nodeId, graph.byId(nodeId))
        return nodeCache.get(nodeId)
      }
      for (const rowId of rowIds) {
        const row = indices.store.byRowId[rowId]
        if (!row) continue
        const knownNode = allowedNodes?.get(row.nodeId)
        if (allowedNodes && !knownNode) continue
        if (preFilter?.node) {
          const node = knownNode ?? getNode(row.nodeId)
          if (!node || !preFilter.node(node)) continue
        }
        if (preFilter?.language) {
          const node = knownNode ?? getNode(row.nodeId)
          const language = node?.get(row.entry.locale)
          if (!language || !preFilter.language(language as any)) continue
        }
        if (!plan.entry(row.entry)) continue
        yield row.entry
      }
      return
    }
    const nodeCache = new Map<string, ReturnType<typeof graph.byId>>()
    const getNode = (nodeId: string) => {
      if (!nodeCache.has(nodeId)) nodeCache.set(nodeId, graph.byId(nodeId))
      return nodeCache.get(nodeId)
    }
    for (const row of indices.store.rows) {
      if (preFilter?.node) {
        const node = getNode(row.nodeId)
        if (!node || !preFilter.node(node)) continue
      }
      if (preFilter?.language) {
        const node = getNode(row.nodeId)
        const language = node?.get(row.entry.locale)
        if (!language || !preFilter.language(language as any)) continue
      }
      if (!plan.entry(row.entry)) continue
      yield row.entry
    }
  }
}
