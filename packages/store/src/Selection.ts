import {CursorData} from './Cursor'
import {Expr, ExprData} from './Expr'
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
    return new Selection(ExprData.Merge(this.expr, Selection.create(that)))
  }

  toExpr(): Expr<T> {
    return new Expr(this.expr)
  }
}

export namespace Selection {
  export type With<A, B> = Selection<
    Omit<A, keyof Store.TypeOf<B>> & Store.TypeOf<B>
  >
}
