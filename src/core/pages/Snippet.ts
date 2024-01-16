import {Expr} from './Expr.js'
import {ExprData} from './ExprData.js'

export function snippet(
  start = '<mark>',
  end = '</mark>',
  cutOff = '...',
  limit = 64
) {
  return Expr(
    ExprData.Call('snippet', [
      ExprData.Value(start),
      ExprData.Value(end),
      ExprData.Value(cutOff),
      ExprData.Value(limit)
    ])
  )
}
