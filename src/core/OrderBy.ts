import type {Expr} from './Expr.js'

export interface AscendingOrder {
  asc: Expr<any>
  desc?: never
}

export interface DescendingOrder {
  asc?: never
  desc: Expr<any>
}

export type OrderBy = AscendingOrder | DescendingOrder
