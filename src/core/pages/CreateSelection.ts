import {Type} from '../Type.js'
import {Cursor} from './Cursor.js'
import {Expr} from './Expr.js'
import {ExprData} from './ExprData.js'
import {Selection} from './Selection.js'
import {Target} from './Target.js'
import {Tree} from './Tree.js'

export function createSelection(input: any) {
  return Type.isType(input) ? fromInput(input()) : fromInput(input)
}

function fromInput(input: any, parent?: any, level = 0): Selection {
  if (input === null || input === undefined)
    return Selection.Expr(ExprData.Value(null))
  if (Cursor.isCursor(input)) return Selection.Cursor(input[Cursor.Data])
  if (Expr.hasExpr(input)) input = input[Expr.ToExpr]()
  if (Expr.isExpr(input)) return Selection.Expr(input[Expr.Data])
  if (Type.isType(input)) return Selection.Row({type: Type.target(input)})
  if (Target.isTarget(input)) return Selection.Row(input[Target.Data])
  if (typeof input === 'function') {
    const self = new Proxy(parent, {
      get(_, prop) {
        const res = parent[prop]
        if (Expr.isExpr(res)) return Selection.Expr(res[Expr.Data], true)
        return res
      }
    })
    return fromInput(input.call(self, new Tree(/*sourceId*/)), level)
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const keys = Object.keys(input)
    return Selection.Record(
      keys.map(key => {
        if (key.startsWith('@@@')) return [input[key]]
        return [key, fromInput(input[key], input, level + 1)]
      })
    )
  }
  return Selection.Expr(ExprData.Value(input))
}
