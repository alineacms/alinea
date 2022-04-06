import {ExprType} from '.'
import {CursorData} from './Cursor'
import {Expr, ExprData} from './Expr'
import type {Store} from './Store'

export const enum SelectionType {
  Expr,
  Cursor,
  Fields,
  Row,
  Case,
  With,
  Process
}

type SelectionInputBase = Expr<any> | Selection<any> | {cursor: CursorData}
interface SelectionInputRecord extends Record<string, SelectionInput> {}
export type SelectionInput = SelectionInputBase | SelectionInputRecord

export type SelectionData =
  | {type: SelectionType.Expr; expr: ExprData}
  | {
      type: SelectionType.Process
      expr: ExprData
      id: string
      fn: (input: any) => any
    }

export const SelectionData = {
  Expr(expr: ExprData): SelectionData {
    return {type: SelectionType.Expr, expr}
  },
  Process(expr: ExprData, id: string, fn: (input: any) => any): SelectionData {
    return {type: SelectionType.Process, expr, id, fn}
  },
  create(input: any): SelectionData {
    if (input instanceof Selection) return input.selection
    if (input instanceof Expr) return SelectionData.Expr(input.expr)
    // We're avoiding an `instanceof Collection` check here beause it would
    // cause a circular import
    if (input && typeof input.as === 'function') return input.fields.selection
    return SelectionData.Expr(ExprData.create(input))
  }
}

export class Selection<T> {
  constructor(public selection: SelectionData) {}

  with<X extends SelectionInput>(that: X): Selection.With<T, X> {
    switch (this.selection.type) {
      case SelectionType.Expr:
        const b = SelectionData.create(that)
        if (b.type === SelectionType.Process)
          throw new Error(`Cannot use with() on a processed value`)
        return new Selection(
          SelectionData.Expr(ExprData.Merge(this.selection.expr, b.expr))
        )
      case SelectionType.Process:
        throw new Error(`Cannot use with() on a processed value`)
    }
  }

  static create<T extends SelectionInput>(
    input: T
  ): Selection<Store.TypeOf<T>> {
    return new Selection(SelectionData.create(input))
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
    case ExprType.Record:
      return Object.values(expr.fields).map(fromExpr).flat()
    case ExprType.Case:
      const selections = Object.values(expr.cases)
      if (expr.defaultCase) selections.push(expr.defaultCase)
      return selections.map(fromExpr).flat()
    case ExprType.Merge:
      return [expr.a, expr.b].map(fromExpr).flat()
    case ExprType.Query:
      return fromSelection(expr.cursor.selection)
    default:
      return []
  }
}

function fromSelection(selection: SelectionData): Array<Mapper> {
  switch (selection.type) {
    case SelectionType.Expr:
      return fromExpr(selection.expr)
    case SelectionType.Process:
      return [[selection.id, selection.fn]]
    default:
      return []
  }
}
export function postProcess(selection: SelectionData, value: any) {
  const toProcess = fromSelection(selection)
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
