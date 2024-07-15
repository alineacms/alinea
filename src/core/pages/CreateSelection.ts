import {isRowId} from '../util/RowId.js'
import {Tree} from './Cursor.js'
import {ExprData, Selection, toSelection} from './ResolveData.js'

export function createSelection(input: any) {
  return fromInput(input)
}

function fromInput(input: any, parent?: any, level = 0): Selection {
  if (input === null || input === undefined)
    return Selection.Expr(ExprData.Value(null))
  if (input[toSelection]) return input[toSelection]()
  if (typeof input === 'function') {
    return fromInput(input.call(parent, new Tree(/*sourceId*/)), level)
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const keys = Object.keys(input)
    return Selection.Record(
      keys.map(key => {
        if (isRowId(key)) return [input[key]]
        return [key, fromInput(input[key], input, level + 1)]
      })
    )
  }
  return Selection.Expr(ExprData.Value(input))
}
