import {Cursor, CursorData} from './Cursor'
import {Expr, ExprData} from './Expr'
import {From} from './From'
import {Select, With} from './Types'

export type SelectionData =
  | {type: 'expr'; expr: ExprData}
  | {type: 'cursor'; cursor: CursorData}
  | {type: 'fields'; fields: Record<string, SelectionData>}
  | {type: 'row'; source: From}
  | {type: 'with'; a: SelectionData; b: SelectionData}

export const SelectionData = {
  Expr(expr: ExprData): SelectionData {
    return {type: 'expr', expr}
  },
  Cursor(cursor: CursorData): SelectionData {
    return {type: 'cursor', cursor}
  },
  Fields(fields: Record<string, SelectionData>): SelectionData {
    return {type: 'fields', fields}
  },
  Row(source: From): SelectionData {
    return {type: 'row', source}
  },
  With(a: SelectionData, b: SelectionData): SelectionData {
    return {type: 'with', a, b}
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

  toJSON() {
    return this.selection
  }
}
