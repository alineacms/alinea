import {CursorData} from './Cursor'
import {Expr, ExprData, ExprType} from './Expr'
import type {Store} from './Store'

type SelectionInputBase = Expr<any> | Selection<any> | {cursor: CursorData}
interface SelectionInputRecord extends Record<string, SelectionInput> {}
export type SelectionInput = SelectionInputBase | SelectionInputRecord

export class Selection<T> {
  constructor(public expr: ExprData) {}

  static create(input: any): ExprData {
    if (input instanceof Selection) return input.expr
    if (input instanceof Expr) return input.expr
    // We're avoiding an `instanceof Collection` check here beause it would
    // cause a circular import
    if (input && typeof input.as === 'function') return input.fields.expr
    return ExprData.create(input)
  }

  with<X extends SelectionInput>(that: X): Selection.With<T, X> {
    switch (this.expr.type) {
      case ExprType.Process:
        throw new Error(`Cannot use with() on a processed value`)
      default:
        const b = Selection.create(that)
        if (b.type === ExprType.Process)
          throw new Error(`Cannot use with() on a processed value`)
        return new Selection(ExprData.Merge(this.expr, b))
    }
  }
}

export namespace Selection {
  export type With<A, B> = Selection<
    Omit<A, keyof Store.TypeOf<B>> & Store.TypeOf<B>
  >
}

type Mapper = [id: string, fn: (value: any) => any]

function fromExpr(expr: ExprData): Array<Mapper> {
  switch (expr.type) {
    case ExprType.Process:
      return [[expr.id, expr.fn]]
    case ExprType.Record:
      return Object.values(expr.fields).map(fromExpr).flat()
    case ExprType.Case:
      const selections = Object.values(expr.cases)
      if (expr.defaultCase) selections.push(expr.defaultCase)
      return selections.map(fromExpr).flat()
    case ExprType.Merge:
      return [expr.a, expr.b].map(fromExpr).flat()
    case ExprType.Query:
      return fromExpr(expr.cursor.selection)
    default:
      return []
  }
}

export function postProcess(expr: ExprData, value: any) {
  const toProcess = fromExpr(expr)
  if (toProcess.length === 0) return value
  const fns = Object.fromEntries(toProcess)
  function process(value: any): any {
    if (!value) return value
    if (Array.isArray(value)) return value.map(process)
    if (typeof value === 'object') {
      if ('$__process' in value && '$__expr' in value) {
        const id = value['$__process']
        const expr = value['$__expr']
        return fns[id](expr)
      }
      const res: any = {}
      for (const key of Object.keys(value)) res[key] = process(value[key])
      return res
    }
    return value
  }
  return process(value)
}
