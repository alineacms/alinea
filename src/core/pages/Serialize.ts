import {Config} from '../Config.js'
import {Root} from '../Root.js'
import {Schema} from '../Schema.js'
import {Workspace} from '../Workspace.js'
import {entries, values} from '../util/Objects.js'
import {unreachable} from '../util/Types.js'
import {CursorData} from './Cursor.js'
import {ExprData} from './Expr.js'
import {Selection} from './Selection.js'
import {TargetData} from './Target.js'

export function seralizeLocation(
  config: Config,
  location: Workspace | Root | undefined
): Array<string> {
  if (!location) return []
  const isWorkspace = Workspace.isWorkspace(location)
  for (const [workspaceName, workspace] of entries(config.workspaces)) {
    if (workspace === location) return [workspaceName]
    if (isWorkspace) continue
    for (const [rootName, root] of entries(workspace)) {
      if (root === location) return [workspaceName, rootName]
    }
  }
  return []
}

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
    for (const order of cursor.orderBy) seralizeExpr(targets, order.expr)
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
    case 'case':
      seralizeExpr(targets, expr.expr)
      for (const [condition, value] of expr.cases) {
        seralizeExpr(targets, condition)
        serializeSelection(targets, value)
      }
      if (expr.defaultCase) serializeSelection(targets, expr.defaultCase)
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
