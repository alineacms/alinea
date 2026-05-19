import type {Entry} from '../Entry.js'
import type {Projection} from '../Graph.js'
import {querySource} from '../Graph.js'
import {getExpr, hasExpr} from '../Internal.js'

export function projectEntry(
  entry: Entry,
  projection: Projection | undefined
): unknown {
  if (!projection) return entry
  const unsupported = unsupportedEntryProjectionReason(projection)
  if (unsupported)
    throw new Error(`Unsupported engine projection: ${unsupported}`)
  return projectSupportedEntry(entry, projection)
}

export function unsupportedEntryProjectionReason(
  projection: Projection | undefined
): string | undefined {
  if (!projection) return
  if (hasExpr(projection as any)) {
    const expr = getExpr(projection as any)
    if (expr.type === 'entryField') return
    return expr.type
  }
  if (!isRecord(projection)) return 'non-object projection'
  if (querySource(projection)) return 'edges'
  for (const value of Object.values(projection)) {
    const reason = unsupportedEntryProjectionReason(value as Projection)
    if (reason) return reason
  }
}

function projectSupportedEntry(entry: Entry, projection: Projection): unknown {
  if (hasExpr(projection as any)) {
    const expr = getExpr(projection as any)
    if (expr.type !== 'entryField')
      throw new Error(`Unsupported engine projection: ${expr.type}`)
    return entry[expr.name as keyof Entry]
  }
  return Object.fromEntries(
    Object.entries(projection as Record<string, Projection>).map(
      ([key, value]) => [key, projectSupportedEntry(entry, value)]
    )
  )
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object')
}
