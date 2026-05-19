export interface QueryTrace {
  graphSha?: string
  rows: ReadonlySet<string>
  nodes: ReadonlySet<string>
  indexes: ReadonlySet<string>
}

export interface QueryTraceInput {
  graphSha?: string
  rows?: Iterable<string>
  nodes?: Iterable<string>
  indexes?: Iterable<string>
}

export interface SerializedQueryTrace {
  graphSha?: string
  rows: Array<string>
  nodes: Array<string>
  indexes: Array<string>
}

export function createQueryTrace(input: QueryTraceInput = {}): QueryTrace {
  return {
    graphSha: input.graphSha,
    rows: new Set(input.rows),
    nodes: new Set(input.nodes),
    indexes: new Set(input.indexes)
  }
}

export function emptyQueryTrace(graphSha?: string): QueryTrace {
  return createQueryTrace({graphSha})
}

export function serializeQueryTrace(
  trace: QueryTrace
): SerializedQueryTrace {
  return {
    graphSha: trace.graphSha,
    rows: Array.from(trace.rows),
    nodes: Array.from(trace.nodes),
    indexes: Array.from(trace.indexes)
  }
}

export function mergeQueryTraces(
  ...traces: Array<QueryTrace | undefined>
): QueryTrace {
  const graphShas = new Set<string>()
  const rows = new Set<string>()
  const nodes = new Set<string>()
  const indexes = new Set<string>()

  for (const trace of traces) {
    if (!trace) continue
    if (trace.graphSha) graphShas.add(trace.graphSha)
    for (const row of trace.rows) rows.add(row)
    for (const node of trace.nodes) nodes.add(node)
    for (const index of trace.indexes) indexes.add(index)
  }

  return {
    graphSha:
      graphShas.size === 1 ? graphShas.values().next().value : undefined,
    rows,
    nodes,
    indexes
  }
}

export function queryTracesOverlap(a: QueryTrace, b: QueryTrace): boolean {
  if (a.graphSha && b.graphSha && a.graphSha !== b.graphSha) return true
  return (
    setsOverlap(a.rows, b.rows) ||
    setsOverlap(a.nodes, b.nodes) ||
    setsOverlap(a.indexes, b.indexes)
  )
}

export function traceRow(trace: QueryTrace, rowId: string): QueryTrace {
  return addTraceValues(trace, {rows: [rowId]})
}

export function traceNode(trace: QueryTrace, nodeId: string): QueryTrace {
  return addTraceValues(trace, {nodes: [nodeId]})
}

export function traceIndex(trace: QueryTrace, indexKey: string): QueryTrace {
  return addTraceValues(trace, {indexes: [indexKey]})
}

function addTraceValues(
  trace: QueryTrace,
  input: Omit<QueryTraceInput, 'graphSha'>
): QueryTrace {
  return mergeQueryTraces(trace, createQueryTrace(input))
}

function setsOverlap<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size > b.size) return setsOverlap(b, a)
  for (const value of a) if (b.has(value)) return true
  return false
}
