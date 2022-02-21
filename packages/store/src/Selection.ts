import {Cursor, CursorData} from './Cursor'
import {Expr, ExprData} from './Expr'
import {From} from './From'
import {Select, With} from './Types'

export const enum SelectionType {
  Expr,
  Cursor,
  Fields,
  Row,
  Case,
  With
}

export type SelectionData =
  | {type: SelectionType.Expr; expr: ExprData}
  | {type: SelectionType.Cursor; cursor: CursorData}
  | {type: SelectionType.Fields; fields: Record<string, SelectionData>}
  | {type: SelectionType.Row; source: From}
  | {
      type: SelectionType.Case
      expr: ExprData
      cases: Record<string, SelectionData>
    }
  | {type: SelectionType.With; a: SelectionData; b: SelectionData}

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
  Case(expr: ExprData, cases: Record<string, SelectionData>): SelectionData {
    return {type: SelectionType.Case, expr, cases}
  },
  With(a: SelectionData, b: SelectionData): SelectionData {
    return {type: SelectionType.With, a, b}
  },
  create(input: any): SelectionData {
    if (input instanceof Selection) return input.selection
    if (input instanceof Expr) return SelectionData.Expr(input.expr)
    // We're avoiding an `instanceof Collection` check here beause it would
    // cause a circular import
    if (input && input.fields instanceof Selection)
      return input.fields.selection
    if (input instanceof Cursor) return SelectionData.Cursor(input.cursor)
    return SelectionData.Fields(
      Object.fromEntries(
        Object.entries(input).map(([key, value]) => [
          key,
          SelectionData.create(value)
        ])
      )
    )
  }
}

export class Selection<T> {
  constructor(public selection: SelectionData) {}

  with<X extends Select>(that: X): With<T, X> {
    return new Selection(
      SelectionData.With(this.selection, SelectionData.create(that))
    )
  }
}
