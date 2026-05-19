import type {Entry} from '../Entry.js'
import type {Order} from '../Graph.js'
import {getExpr, hasExpr} from '../Internal.js'

export function orderEntries(
  entries: Array<Entry>,
  orderBy: Order | Array<Order>
) {
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  entries.sort((a, b) => {
    for (const order of orders) {
      const expr = order.asc ?? order.desc
      if (!expr || !hasExpr(expr as any)) continue
      const internal = getExpr(expr as any)
      if (internal.type !== 'entryField') continue
      const result = compareValues(
        a[internal.name as keyof Entry],
        b[internal.name as keyof Entry],
        order.caseSensitive
      )
      if (result !== 0) return order.asc ? result : -result
    }
    return 0
  })
}

export function unsupportedEntryOrderReason(
  orderBy: Order | Array<Order> | undefined
): string | undefined {
  if (!orderBy) return
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  for (const order of orders) {
    const expr = order.asc ?? order.desc
    if (!expr) return 'missing expression'
    if (!hasExpr(expr as any)) return 'non-expression'
    const internal = getExpr(expr as any)
    if (internal.type !== 'entryField') return internal.type
  }
}

function compareValues(
  a: unknown,
  b: unknown,
  caseSensitive: boolean | undefined
) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string') {
    return caseSensitive
      ? a.localeCompare(b)
      : a.localeCompare(b, undefined, {numeric: true})
  }
  return 0
}
