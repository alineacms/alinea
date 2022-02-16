import {Collection} from './Collection'
import {Cursor, CursorData} from './Cursor'
import {Expr, ExprData} from './Expr'
import {From} from './From'

export type SelectionData =
  | {type: 'expr'; expr: ExprData}
  | {type: 'cursor'; cursor: CursorData}
  | {type: 'fieldsOf'; source: From; add?: SelectionData}
  | {type: 'fields'; fields: Record<string, SelectionData>}
  | {type: 'row'; source: From}

export const SelectionData = {
  Expr(expr: ExprData): SelectionData {
    return {type: 'expr', expr}
  },
  Cursor(cursor: CursorData): SelectionData {
    return {type: 'cursor', cursor}
  },
  FieldsOf(source: From, add?: SelectionData): SelectionData {
    return {type: 'fieldsOf', source, add}
  },
  Fields(fields: Record<string, SelectionData>): SelectionData {
    return {type: 'fields', fields}
  },
  Row(source: From): SelectionData {
    return {type: 'row', source}
  },
  create(input: any): SelectionData {
    if (input instanceof Selection) return input.selection
    if (input instanceof Expr) return SelectionData.Expr(input.expr)
    if (input instanceof Collection) return SelectionData.Fields(input.fields)
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

  with<X>(that: X): Selection<T & X> {
    switch (this.selection.type) {
      case 'fieldsOf':
        return new Selection(
          SelectionData.FieldsOf(
            this.selection.source,
            SelectionData.create(that)
          )
        )
      default:
        throw 'assert'
    }
  }

  toJSON() {
    return this.selection
  }
}
