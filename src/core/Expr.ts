import type {EdgeQuery} from './Graph.js'
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
  | {type: 'entryField'; name: string; path?: Array<string>}
  | {type: 'call'; method: string; args: Array<Expr>}
  | {type: 'value'; value: unknown}
  /** The single value a query of related entries selects, eg. a linked title */
  | {type: 'relation'; query: EdgeQuery}
  /** A different expression per entry type, null for other types */
  | {type: 'typeSwitch'; cases: Record<string, Expr>}
