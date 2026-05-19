import type {Entry} from '../Entry.js'
import type {Expr} from '../Expr.js'
import {getExpr, hasExpr} from '../Internal.js'

export function groupEntries(
  entries: Array<Entry>,
  groupBy: Expr
): Array<Entry> {
  const groups = new Map<unknown, Entry>()
  const internal = getExpr(groupBy as any)
  for (const entry of entries) {
    const value =
      internal.type === 'entryField'
        ? entry[internal.name as keyof Entry]
        : undefined
    if (!groups.has(value)) groups.set(value, entry)
  }
  return Array.from(groups.values())
}

export function unsupportedEntryGroupReason(
  groupBy: Expr | Array<Expr> | undefined
): string | undefined {
  if (!groupBy) return
  if (Array.isArray(groupBy)) return 'multiple fields'
  if (!hasExpr(groupBy as any)) return 'non-expression'
  const internal = getExpr(groupBy as any)
  if (internal.type !== 'entryField') return internal.type
}
