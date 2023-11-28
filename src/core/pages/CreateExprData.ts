import {Expr} from './Expr.js'
import {ExprData} from './ExprData.js'

const {entries, fromEntries} = Object

export function createExprData(input: any): ExprData {
  if (input === null || input === undefined) return ExprData.Value(null)
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return input[Expr.Data]
  if (input && typeof input === 'object' && !Array.isArray(input))
    return ExprData.Record(
      fromEntries(
        entries(input).map(([key, value]) => [key, createExprData(value)])
      )
    )
  return ExprData.Value(input)
}
