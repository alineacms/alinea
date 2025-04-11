import {type HasExpr, internalExpr} from './Internal.js'

declare const brand: unique symbol
export class Expr<Value = unknown> implements HasExpr {
  declare [brand]: Value;
  [internalExpr]: ExprInternal

  constructor(data: ExprInternal) {
    this[internalExpr] = data
  }
}

export type ExprInternal =
  | {type: 'field'}
  | {type: 'entryField'; name: string}
  | {type: 'call'; method: string; args: Array<Expr>}
  | {type: 'value'; value: unknown}
