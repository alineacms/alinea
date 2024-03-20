import {Expr} from './Expr.js'
import {ExprData} from './ResolveData.js'

export function snippet(
  start = '<mark>',
  end = '</mark>',
  cutOff = '...',
  limit = 64
): Expr<string> {
  return Expr(
    ExprData.Call('snippet', [
      ExprData.Value(start),
      ExprData.Value(end),
      ExprData.Value(cutOff),
      ExprData.Value(limit)
    ])
  )
}
