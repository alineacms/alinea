import {Cursor, CursorData} from './Cursor'
import {Expr, ExprData} from './Expr'
import {From} from './From'
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
  | {type: SelectionType.Cursor; cursor: CursorData}
  | {type: SelectionType.Fields; fields: Record<string, SelectionData>}
  | {type: SelectionType.Row; source: From}
  | {
      type: SelectionType.Case
      expr: ExprData
      cases: Record<string, SelectionData>
      defaultCase?: SelectionData
    }
  | {type: SelectionType.With; a: SelectionData; b: SelectionData}
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
  Cursor(cursor: CursorData): SelectionData {
    return {type: SelectionType.Cursor, cursor}
  },
  Fields(fields: Record<string, SelectionData>): SelectionData {
    return {type: SelectionType.Fields, fields}
  },
  Row(source: From): SelectionData {
    return {type: SelectionType.Row, source}
  },
  Case(
    expr: ExprData,
    cases: Record<string, SelectionData>,
    defaultCase?: SelectionData
  ): SelectionData {
    return {type: SelectionType.Case, expr, cases, defaultCase}
  },
  With(a: SelectionData, b: SelectionData): SelectionData {
    return {type: SelectionType.With, a, b}
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
    if (input instanceof Cursor) return SelectionData.Cursor(input.cursor)
    if (input && typeof input === 'object')
      return SelectionData.Fields(
        Object.fromEntries(
          Object.entries(input).map(([key, value]) => [
            key,
            SelectionData.create(value)
          ])
        )
      )
    return SelectionData.Expr(Expr.value(input).expr)
  }
}

export class Selection<T> {
  constructor(public selection: SelectionData) {}

  with<X extends SelectionInput>(that: X): Selection.With<T, X> {
    return new Selection(
      SelectionData.With(this.selection, SelectionData.create(that))
    )
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

export function postProcess(selection: SelectionData, value: any) {
  function get(selection: SelectionData): Array<Mapper> {
    switch (selection.type) {
      case SelectionType.Fields:
        return Object.values(selection.fields).map(get).flat()
      case SelectionType.Case:
        const selections = Object.values(selection.cases)
        if (selection.defaultCase) selections.push(selection.defaultCase)
        return selections.map(get).flat()
      case SelectionType.With:
        return [selection.a, selection.b].map(get).flat()
      case SelectionType.Cursor:
        return get(selection.cursor.selection)
      case SelectionType.Process:
        return [[selection.id, selection.fn]]
      default:
        return []
    }
  }
  const toProcess = get(selection)
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
