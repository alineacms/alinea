import {Schema} from '../Schema.js'
import {values} from '../util/Objects.js'
import {unreachable} from '../util/Types.js'
import {CursorData} from './Cursor.js'
import {ExprData} from './Expr.js'
import {Selection} from './Selection.js'
import {TargetData} from './Target.js'

export function serializeSelection(
  targets: Schema.Targets,
  selection: Selection | undefined
): void {
  if (!selection) return
  switch (selection.type) {
    case 'cursor':
      return serializeCursor(targets, selection.cursor)
    case 'record':
      return serializeRecord(targets, selection)
    case 'expr':
      return seralizeExpr(targets, selection.expr)
    case 'row':
      return serializeTarget(targets, selection.target)
  }
}

function serializeCursor(targets: Schema.Targets, cursor: CursorData): void {
  serializeTarget(targets, cursor.target)
  seralizeExpr(targets, cursor.where)
  if (cursor.orderBy)
    for (const order of cursor.orderBy) seralizeExpr(targets, order)
  serializeSelection(targets, cursor.select)
}

function serializeRecord(
  targets: Schema.Targets,
  record: Selection.Record
): void {
  for (const [key, value] of record.fields) {
    if (typeof key === 'string') {
      serializeSelection(targets, value)
    } else {
      serializeTarget(targets, value)
    }
  }
}

function seralizeExpr(
  targets: Schema.Targets,
  expr: ExprData | undefined
): void {
  if (!expr) return
  switch (expr.type) {
    case 'unop':
      return seralizeExpr(targets, expr.expr)
    case 'binop':
      seralizeExpr(targets, expr.a)
      seralizeExpr(targets, expr.b)
      return
    case 'field':
      return serializeTarget(targets, expr.target)
    case 'access':
      return seralizeExpr(targets, expr.expr)
    case 'value':
      return
    case 'record':
      for (const field of values(expr.fields)) seralizeExpr(targets, field)
      return
    default:
      unreachable(expr)
  }
}

function serializeTarget(
  targets: Schema.Targets,
  target: TargetData | undefined
): void {
  if (!target?.type) return
  const name = targets.get(target.type)
  if (!name) throw new Error(`Unknown target ${target.type}`)
  target.name = name
}
